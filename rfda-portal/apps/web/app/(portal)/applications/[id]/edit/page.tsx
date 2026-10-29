'use client';
import {
  ARTWORK_ID, CONDITION_LABEL, EDITABLE_FIELDS, canEdit, LABEL_LANGUAGES, STEPS, TYPES, allIssues, docsFor, filesFor, fileSize, fmtDate, fmtDateTime, groupDocs,
  isMedicine, money, validateStep, visibleFields, type ApplicationDto, type DocRequirement, type FieldDef, type ProductFields,
} from '@rfda/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Icon } from '@/components/Icon';
import { AiPrecheck } from '@/components/AiReview';
import { PayModal } from '@/components/modals';
import { NotFound } from '@/components/NotFound';
import { storeApp } from '@/components/session';
import { ModalFrame, useBusy, useModal, useToast } from '@/components/ui';
import { api, ApiError, errMsg, fileUrl } from '@/lib/api';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.zip';
const pick = (app: ApplicationDto) => Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, app[k]])) as unknown as ProductFields;

export default function EditApplication() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: app, error } = useSWR<ApplicationDto>(`/applications/${id}`, fetcherNoRetry, { revalidateOnFocus: false });

  useEffect(() => { if (app && !canEdit(app)) router.replace(`/applications/${app.id}`); }, [app, router]);
  if (error) return <NotFound back="/applications" />;
  if (!app || !canEdit(app)) return <p className="loading">Loading…</p>;
  return <Wizard key={app.id} initial={app} />;
}
const fetcherNoRetry = (path: string) => api<ApplicationDto>(path);

function Wizard({ initial }: { initial: ApplicationDto }) {
  const router = useRouter();
  const toast = useToast();
  const openModal = useModal();
  const { data } = useSWR<ApplicationDto>(`/applications/${initial.id}`, fetcherNoRetry, { revalidateOnFocus: false });
  const app = data || initial;
  // A submitted application being changed while it is with the applicant: explicit saves, each one logged.
  const amend = !initial.isDraft;
  const [form, setForm] = useState<ProductFields>(() => pick(initial));
  const [step, setStepState] = useState(amend ? 0 : Math.min(initial.step || 0, 4));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(amend ? '' : `Saved ${fmtDateTime(initial.updatedAt)}`);
  const [dirty, setDirty] = useState(false);

  /* Drafts autosave: changes collect in `pending` and are sent 600 ms after the last edit. */
  const pending = useRef<Partial<ProductFields> & { step?: number }>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!Object.keys(body).length) return true;
    pending.current = {};
    setSaved('Saving…');
    try {
      storeApp(await api<ApplicationDto>(`/applications/${initial.id}`, { method: 'PATCH', body }));
      setSaved(amend ? 'Changes saved' : 'Saved just now');
      setDirty(false);
      if (amend && Object.keys(body).some((k) => k !== 'step')) toast('Changes saved and recorded in the application history.');
      return true;
    } catch (e) {
      pending.current = { ...body, ...pending.current };
      setSaved('Not saved');
      if (e instanceof ApiError && e.issues) setInvalid(new Set(e.issues.map((i) => i.k!).filter(Boolean)));
      toast(amend ? errMsg(e) : `Your last changes were not saved: ${errMsg(e)}`);
      return false;
    }
  }, [initial.id, toast, amend]);
  useEffect(() => () => { if (!amend) flush(); }, [flush, amend]);

  const change = <K extends keyof ProductFields>(k: K, v: ProductFields[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    pending.current[k] = v;
    setInvalid((s) => { if (!s.has(k)) return s; const n = new Set(s); n.delete(k); return n; });
    setSaved('Unsaved changes');
    setDirty(true);
    clearTimeout(timer.current);
    if (!amend) timer.current = setTimeout(flush, 600);
  };
  const goStep = async (s: number) => {
    if (amend && !(await flush())) return;
    if (!amend) pending.current.step = s;
    setStepState(s);
    setInvalid(new Set());
    window.scrollTo(0, 0);
    if (!amend) await flush();
  };

  const merged: ApplicationDto = { ...app, ...form };
  const t = TYPES[app.type];
  const doneSteps = [0, 1, 2, 3].map((i) => validateStep(merged, i).length === 0);

  const next = () => {
    const issues = validateStep(merged, step);
    if (step < 2 && issues.length) {
      setInvalid(new Set(issues.map((i) => i.k!)));
      document.getElementById('f_' + issues[0].k)?.focus();
      toast(`${issues.length} required field${issues.length > 1 ? 's are' : ' is'} empty. You can also continue later.`);
      return;
    }
    if (issues.length) toast(`${issues.length} item${issues.length > 1 ? 's' : ''} still missing in this step. You can add ${issues.length > 1 ? 'them' : 'it'} before submitting.`);
    goStep(step + 1);
  };
  const discard = () => openModal((close) => (
    <ModalFrame title="Delete this draft?" footer={<><button className="btn" onClick={close}>Keep draft</button><button className="btn danger" onClick={async () => {
      clearTimeout(timer.current); pending.current = {};
      try { await api(`/applications/${app.id}`, { method: 'DELETE' }); close(); await mutate('/applications'); router.push('/applications'); toast('Draft deleted.'); }
      catch (e) { toast(errMsg(e)); }
    }}>Delete draft</button></>}>
      <p>The draft and any files attached to it are removed. This can’t be undone.</p>
    </ModalFrame>
  ));

  const steps = amend ? STEPS.map((s, i) => (i === 4 ? { t: 'Check and finish', s: 'Make sure nothing is missing' } : s)) : STEPS;
  return (
    <>
      <div className="page-head"><div>
        <div className="crumbs"><Link href="/applications">My applications</Link> / {amend ? <><Link href={`/applications/${app.id}`}>{app.ref}</Link> / Change</> : 'Draft'}</div>
        <h1>{amend ? `Change ${app.ref}` : form.brand || 'New product application'}</h1>
        <p className="sub">{t.name}, {form.category}. {form.submissionType}. {amend ? 'Each saved change is recorded in the application history and shown to Rwanda FDA.' : 'Tracking number assigned when you submit.'}</p></div></div>
      {amend && <div className="notice gold" style={{ marginBottom: 20 }}><strong>{app.status === 'queried' ? 'Make the changes asked for in the query, then send your response from the Queries tab.' : 'You can change the application until you pay the invoice.'}</strong>
        <p className="small">Changed documents are checked again by Rwanda FDA. The product type can’t be changed; start a new application for a different type.</p></div>}
      <div className="wizard">
        <ol className="steps" aria-label="Application steps">
          {steps.map((s, i) => {
            const done = i < 4 && doneSteps[i] && i !== step;
            return (
              <li key={s.t} className={`${i === step ? 'current' : ''} ${done ? 'done' : ''}`}>
                <button onClick={() => goStep(i)} aria-current={i === step ? 'step' : undefined}><span className="num">{done ? <Icon name="check" /> : i + 1}</span><span><span className="t">{s.t}</span><br /><span className="s">{s.s}</span></span></button>
              </li>
            );
          })}
        </ol>
        <section className="panel">
          <div className="panel-head"><div><h2>{steps[step].t}</h2><p className="small muted">Step {step + 1} of 5</p></div><span className="spacer" /><span className="saved" aria-live="polite">{saved}</span></div>
          <div className="panel-pad">
            {step < 2 && <div className="grid-2">{visibleFields(merged, step).map((f) => <Field key={f.k} f={f} value={form[f.k]} invalid={invalid.has(f.k)} onChange={(v) => change(f.k, v as never)} />)}</div>}
            {step === 2 && <DocsStep app={merged} />}
            {step === 3 && <LabelStep app={merged} form={form} change={change} />}
            {step === 4 && (amend ? <FinishStep app={merged} goStep={goStep} /> : <ReviewStep app={merged} goStep={goStep} flush={flush} />)}
          </div>
          {amend ? (
            <div className="wizard-foot">
              {step > 0 && <button className="btn" onClick={() => goStep(step - 1)}>Back</button>}
              <Link className="btn link" href={`/applications/${app.id}`}>{dirty ? 'Cancel unsaved changes' : 'Back to application'}</Link>
              <span className="spacer" />
              {(step < 2 || step === 3) && <button className="btn" disabled={!dirty} onClick={() => flush()}>Save changes</button>}
              {step < 4 && <button className="btn primary" onClick={() => goStep(step + 1)}>{dirty ? 'Save and continue' : 'Continue'}</button>}
            </div>
          ) : (
            <div className="wizard-foot">
              {step > 0 && <button className="btn" onClick={() => goStep(step - 1)}>Back</button>}
              <button className="btn link" onClick={async () => { await flush(); router.push('/dashboard'); }}>Save and exit</button>
              <span className="spacer" />
              {step < 4 && <button className="btn primary" onClick={next}>Save and continue</button>}
              <button className="btn danger small" onClick={discard}>Delete draft</button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Field({ f, value, invalid, onChange }: { f: FieldDef; value: unknown; invalid: boolean; onChange: (v: string | boolean) => void }) {
  const id = 'f_' + f.k;
  if (f.type === 'check') {
    return (
      <div className={f.span ? 'span-all' : ''}><label className="check"><input type="checkbox" id={id} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{f.l}<br /><span className="small muted">If checked, you’ll be asked for the notarized agreement in the next step.</span></span></label></div>
    );
  }
  const v = String(value ?? '');
  let ctl;
  if (f.type === 'select') ctl = <select id={id} value={v} onChange={(e) => onChange(e.target.value)}><option value="">Select</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>;
  else if (f.type === 'textarea') ctl = <textarea id={id} value={v} onChange={(e) => onChange(e.target.value)} />;
  else ctl = <input id={id} type={f.type === 'number' ? 'number' : 'text'} min={f.type === 'number' ? 1 : undefined} inputMode={f.type === 'number' ? 'numeric' : undefined} value={v} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className={`field ${f.span ? 'span-all' : ''} ${invalid ? 'invalid' : ''}`}>
      <label htmlFor={id} className={f.req ? 'req' : ''}>{f.l}</label>{ctl}
      {f.hint && <span className="hint">{f.hint}</span>}
      <span className="error">{f.type === 'select' ? 'Select' : 'Enter'} the {f.l.toLowerCase()}.</span>
    </div>
  );
}

/* ---------------------------------------------------------------- Step 3: documents */

function useUpload(app: ApplicationDto) {
  const toast = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const upload = async (requirementId: string, files: FileList | null) => {
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    setUploading(requirementId);
    try {
      storeApp(await api<ApplicationDto>(`/applications/${app.id}/files/${requirementId}`, { body: fd }));
      toast(files.length > 1 ? `${files.length} files attached.` : `${files[0].name} attached.`);
    } catch (e) { toast(errMsg(e)); } finally { setUploading(null); }
  };
  const remove = async (fileId: string) => {
    try { storeApp(await api<ApplicationDto>(`/applications/${app.id}/files/${fileId}`, { method: 'DELETE' })); } catch (e) { toast(errMsg(e)); }
  };
  return { uploading, upload, remove };
}

function UploadButton({ requirementId, label, multiple, busy, onFiles }: { requirementId: string; label: string; multiple?: boolean; busy: boolean; onFiles: (id: string, f: FileList | null) => void }) {
  return (
    <label className="btn small" aria-disabled={busy}><Icon name="upload" /><span>{busy ? 'Uploading…' : label}</span>
      <input type="file" className="sr-only" accept={ACCEPT} multiple={multiple} disabled={busy} onChange={(e) => { onFiles(requirementId, e.target.files); e.target.value = ''; }} /></label>
  );
}

function DocsStep({ app }: { app: ApplicationDto }) {
  const { uploading, upload, remove } = useUpload(app);
  const docs = docsFor(app);
  const req = docs.filter((d) => d.req);
  const done = req.filter((d) => filesFor(app, d.id).length).length;
  return (
    <>
      <p className="muted">Upload each document against its requirement. CTD modules and other documents can have several files. Accepted: PDF, Word, Excel, images and ZIP.</p>
      {app.type === 'HM' && app.srA !== 'Yes' && <div className="notice sky" style={{ marginTop: 12 }}><p className="small">If this product is registered by a reference regulatory authority, answer <strong>Yes</strong> in step 2 to use the reliance pathway. You’ll then be asked for the declaration of sameness, the authority’s GMP certificate and the letter of authorization.</p></div>}
      <div className="row" style={{ margin: '14px 0 6px' }}><strong>{done} of {req.length} required documents uploaded</strong></div>
      <div className="progress"><i style={{ width: `${req.length ? Math.round((done / req.length) * 100) : 100}%` }} /></div>
      <ul className="doc-list" style={{ margin: '14px -22px -20px' }}>
        {groupDocs(docs).map(([group, items]) => (
          <GroupRows key={group} title={group}>
            {items.map((d) => <DocRow key={d.id} d={d} app={app} busy={uploading === d.id} upload={upload} remove={remove} />)}
          </GroupRows>
        ))}
      </ul>
    </>
  );
}

function GroupRows({ title, children }: { title: string; children: React.ReactNode }) {
  return <><li className="doc-group" style={{ display: 'block' }}>{title}</li>{children}</>;
}

function DocRow({ d, app, busy, upload, remove }: { d: DocRequirement; app: ApplicationDto; busy: boolean; upload: (id: string, f: FileList | null) => void; remove: (fileId: string) => void }) {
  const files = filesFor(app, d.id);
  return (
    <li>
      <span className={`doc-state ${files.length ? 'ok' : ''}`}>{files.length ? <Icon name="check" /> : null}</span>
      <div>
        <div className="doc-name">{d.name}{!d.req && <span className="muted" style={{ fontWeight: 400 }}> (optional)</span>}{d.when && <span className="muted" style={{ fontWeight: 400 }}> ({CONDITION_LABEL[d.when]})</span>}</div>
        {d.hint && <div className="doc-file">{d.hint}</div>}
        {files.length ? (
          <ul className="doc-files">{files.map((f) => (
            <li key={f.id}><a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer">{f.name}</a><span>{fileSize(f.size)}, uploaded {fmtDate(f.at)}</span>
              <button className="btn small link" onClick={() => remove(f.id)}>Remove</button></li>
          ))}</ul>
        ) : <div className="doc-file">Not uploaded{d.multiple ? '. You can select several files.' : ''}</div>}
      </div>
      <div className="row"><UploadButton requirementId={d.id} label={files.length ? (d.multiple ? 'Add files' : 'Replace') : 'Upload'} multiple={d.multiple} busy={busy} onFiles={upload} /></div>
    </li>
  );
}

/* ---------------------------------------------------------------- Step 4: label */

function LabelStep({ app, form, change }: { app: ApplicationDto; form: ProductFields; change: <K extends keyof ProductFields>(k: K, v: ProductFields[K]) => void }) {
  const { uploading, upload } = useUpload(app);
  const a = filesFor(app, ARTWORK_ID)[0];
  return (
    <div className="stack">
      <p className="muted">Upload the label exactly as it will appear on the market, and paste its text. The text lets reviewers, and later the AI checks, compare the label with the requirements.</p>
      <div className="panel" style={{ padding: '16px 18px' }}><div className="row">
        <span className={`doc-state ${a ? 'ok' : ''}`}>{a ? <Icon name="check" /> : null}</span>
        <div style={{ flex: 1 }}><div className="doc-name">Label or artwork file</div><div className="doc-file">{a ? <><a href={fileUrl(a.id)} target="_blank" rel="noopener noreferrer">{a.name}</a>, {fileSize(a.size)}</> : 'PDF or image of every side of the pack'}</div></div>
        <UploadButton requirementId={ARTWORK_ID} label={a ? 'Replace' : 'Upload'} busy={uploading === ARTWORK_ID} onFiles={upload} />
      </div></div>
      <div className="field"><label htmlFor="ltext" className="req">Label text</label>
        <textarea id="ltext" style={{ minHeight: 150 }} placeholder="Copy every statement on the label: name, strength or net content, storage, expiry and batch format, manufacturer, warnings" value={form.labelText} onChange={(e) => change('labelText', e.target.value)} /></div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="label" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Languages on the label</legend>
        <div className="row">{LABEL_LANGUAGES.map((l) => (
          <label key={l} className="check"><input type="checkbox" checked={form.labelLanguages.includes(l)} onChange={(e) => change('labelLanguages', e.target.checked ? [...form.labelLanguages, l] : form.labelLanguages.filter((x) => x !== l))} /><span>{l}</span></label>
        ))}</div></fieldset>
    </div>
  );
}

/* ---------------------------------------------------------------- Step 5: review and submit */

function FinishStep({ app, goStep }: { app: ApplicationDto; goStep: (s: number) => void }) {
  const issues = allIssues(app);
  const next = app.status === 'queried' ? 'send your response to the query' : 'pay the invoice';
  return (
    <>
      <div className={issues.length ? 'notice gold' : 'notice'} style={issues.length ? undefined : { background: 'var(--green-soft)', borderColor: 'transparent' }}>
        <strong>{issues.length ? `${issues.length} item${issues.length > 1 ? 's' : ''} to complete before you can ${next}` : `Your application is complete. You can now ${next}.`}</strong>
        {issues.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{issues.map((i, n) => <li key={n}><button className="btn link small" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => goStep(i.step)}>{i.msg}</button></li>)}</ul>}
      </div>
      <div style={{ marginTop: 16 }}><AiPrecheck app={app} /></div>
      <div className="row" style={{ marginTop: 16 }}>
        <Link className="btn primary" href={`/applications/${app.id}${app.status === 'queried' ? '?tab=queries' : ''}`}>{app.status === 'queried' ? 'Go to the query' : 'Back to application'}</Link>
      </div>
    </>
  );
}

function ReviewStep({ app, goStep, flush }: { app: ApplicationDto; goStep: (s: number) => void; flush: () => Promise<boolean> }) {
  const router = useRouter();
  const toast = useToast();
  const openModal = useModal();
  const { busy, run } = useBusy();
  const [declared, setDeclared] = useState(false);
  const issues = allIssues(app);
  const t = TYPES[app.type];
  const docs = docsFor(app);

  const submit = () => {
    if (!declared) { toast('Tick the declaration to submit.'); document.getElementById('declare')?.focus(); return; }
    run(async () => {
      await flush();
      const done = await api<ApplicationDto>(`/applications/${app.id}/submit`, { body: { declaration: true } });
      storeApp(done);
      router.push(`/applications/${done.id}`);
      openModal((close) => (
        <ModalFrame title="Application submitted" footer={<><button className="btn" onClick={close}>Pay later</button><button className="btn primary" onClick={() => { close(); openModal((c) => <PayModal app={done} close={c} />); }}>Pay or upload proof now</button></>}>
          <p>Your tracking number is</p><p style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 12px' }}>{done.ref}</p>
          <p className="muted">Pay invoice {done.invoice?.no} of {money(done.invoice?.amount)} and upload the proof of payment. Rwanda FDA starts screening once the payment is confirmed.</p>
        </ModalFrame>
      ));
    });
  };

  const Sec = ({ i, title, children }: { i: number; title: string; children: React.ReactNode }) => (
    <section style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}><div className="row" style={{ marginBottom: 10 }}><h3>{title}</h3><span className="spacer" /><button className="btn link small" onClick={() => goStep(i)}>Change</button></div>{children}</section>
  );
  const Facts = ({ pairs }: { pairs: [string, string | undefined][] }) => <dl className="facts">{pairs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>;

  return (
    <>
      <div className={issues.length ? 'notice gold' : 'notice'} style={issues.length ? undefined : { background: 'var(--green-soft)', borderColor: 'transparent' }}>
        <strong>{issues.length ? `${issues.length} item${issues.length > 1 ? 's' : ''} to complete before you can submit` : 'Your application is complete'}</strong>
        {issues.length ? <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{issues.map((i, n) => <li key={n}><button className="btn link small" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => goStep(i.step)}>{i.msg}</button></li>)}</ul>
          : <p className="small" style={{ marginTop: 4 }}>All required details and documents are in place.</p>}
      </div>
      <div style={{ marginTop: 16 }}><AiPrecheck app={app} beforeRequest={flush} /></div>
      <div style={{ marginTop: 8 }}>
        <Sec i={0} title="Product details"><Facts pairs={[['Brand name', app.brand], [isMedicine(app.type) ? 'Active ingredient' : 'Common name', app.generic], ['Category', app.category], ['Form', app.form], [t.sizeLabel, app.size], ['Intended users', app.intendedUsers], ['Storage', app.storage], ['Shelf life', app.shelfLife ? app.shelfLife + ' months' : '']]} /></Sec>
        <Sec i={1} title="Manufacturer and representative"><Facts pairs={[['Manufacturer', app.mfrName], ['Country', app.mfrCountry], ['Site address', app.mfrAddress], ['Origin', app.origin], ['Reference authority', app.srA === 'Yes' ? app.refAuthority : 'Not applicable'], ['Local technical representative', app.ltr]]} /></Sec>
        <Sec i={2} title="Dossier documents">
          <ul className="need-list">{docs.map((d) => { const n = filesFor(app, d.id).length; return <li key={d.id} className={n ? '' : 'opt'}>{d.name}: <span className="muted">{n ? `${n} file${n > 1 ? 's' : ''}` : d.req ? 'missing' : 'not provided'}</span></li>; })}</ul>
        </Sec>
        <Sec i={3} title="Label and artwork"><Facts pairs={[['Artwork', filesFor(app, ARTWORK_ID)[0]?.name], ['Languages', app.labelLanguages.join(', ')]]} /></Sec>
      </div>
      <section style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}><h3>Fee</h3><p style={{ marginTop: 6 }}>An invoice of <strong>{money(t.fee)}</strong> is issued when you submit. Assessment starts once payment is confirmed.</p></section>
      <label className="check" style={{ marginTop: 18 }}><input type="checkbox" id="declare" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
        <span>I declare that the information in this application is true and complete, and that I am authorized to submit it on behalf of {app.applicant}.</span></label>
      <div className="row" style={{ marginTop: 16 }}><button className="btn primary" disabled={!!issues.length || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit application'}</button>{issues.length > 0 && <span className="small muted">Complete the items above to submit.</span>}</div>
    </>
  );
}

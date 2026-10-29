'use client';
import {
  ARTWORK_ID, CONDITION_LABEL, STAGE_NAME, TYPES, docsFor, filesFor, fileSize, fmtDate, fmtDateTime, groupDocs, isMedicine, lastOpenQuery, money,
  type ApplicationDto, type FileDto,
} from '@rfda/shared';
import { FormEvent, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { Icon } from './Icon';
import { InvoiceBadge } from './journey';
import { InvoiceModal, PayModal } from './modals';
import { storeApp } from './session';
import { useBusy, useModal, useToast } from './ui';

export type Role = 'applicant' | 'fda';
export type TabKey = 'overview' | 'documents' | 'payment' | 'queries' | 'history';

export function Tabs({ tabs, tab, setTab, app }: { tabs: [TabKey, string][]; tab: TabKey; setTab: (t: TabKey) => void; app: ApplicationDto }) {
  const openQ = app.queries.filter((q) => q.from === 'fda' && !q.answered).length;
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{k === 'queries' && openQ ? <span className="dot">{openQ}</span> : null}</button>
      ))}
    </div>
  );
}

export function AppTab({ app, tab, role }: { app: ApplicationDto; tab: TabKey; role: Role }) {
  if (tab === 'overview') return <Overview app={app} />;
  if (tab === 'documents') return <Documents app={app} role={role} />;
  if (tab === 'payment') return <Payment app={app} role={role} />;
  if (tab === 'queries') return <Queries app={app} role={role} />;
  return <History app={app} />;
}

export function ProductFacts({ app }: { app: ApplicationDto }) {
  const t = TYPES[app.type];
  const rows: [string, string][] = [
    ['Brand name', app.brand], [isMedicine(app.type) ? 'Active ingredient' : 'Common name', app.generic], ['Category', app.category], ['Form', app.form], [t.sizeLabel, app.size],
    ['Intended users', app.intendedUsers], ['Intended use', app.intendedUse], ['Storage', app.storage], ['Shelf life', app.shelfLife ? app.shelfLife + ' months' : ''],
    ['Manufacturer', app.mfrName], ['Country of manufacture', app.mfrCountry], ['Origin', app.origin],
    ['Registered by a recognized authority', app.srA === 'Yes' ? `Yes${app.refAuthority ? `: ${app.refAuthority}` : ''}` : 'No'],
    ['Local technical representative', app.ltr], ['Submission type', app.submissionType],
  ];
  return <dl className="facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>;
}

function Overview({ app }: { app: ApplicationDto }) {
  return (
    <>
      <ProductFacts app={app} />
      {app.labelText && <div style={{ marginTop: 20 }}><h3>Label text</h3><p style={{ marginTop: 6, whiteSpace: 'pre-wrap', maxWidth: '80ch' }}>{app.labelText}</p></div>}
    </>
  );
}

export function FileLinks({ files, role }: { files: FileDto[]; role: Role }) {
  return (
    <ul className="doc-files">
      {files.map((f) => (
        <li key={f.id}>
          <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer">{f.name}</a>
          <span>{fileSize(f.size)}, uploaded {fmtDate(f.at)}</span>
          <a className="small" href={fileUrl(f.id, false)}>{role === 'fda' ? 'Download' : 'Save'}</a>
        </li>
      ))}
    </ul>
  );
}

/** Every requirement, grouped, with the files uploaded against it; then label, payment and query files. */
function Documents({ app, role }: { app: ApplicationDto; role: Role }) {
  const docs = docsFor(app);
  const extra: { name: string; files: FileDto[] }[] = [
    { name: 'Label or artwork', files: filesFor(app, ARTWORK_ID) },
    { name: 'Proof of payment', files: app.invoice?.proof ? [app.invoice.proof] : [] },
    ...app.queries.filter((q) => q.files.length).map((q) => ({ name: `Attached to query response (${fmtDate(q.at)})`, files: q.files })),
  ].filter((x) => x.files.length);
  return (
    <ul className="doc-list" style={{ margin: '-20px -22px' }}>
      {groupDocs(docs).map(([group, items]) => (
        <DocGroup key={group} title={group}>
          {items.map((d) => {
            const files = filesFor(app, d.id);
            return (
              <li key={d.id}>
                <span className={`doc-state ${files.length ? 'ok' : d.req ? 'missing' : ''}`}>{files.length ? <Icon name="check" /> : null}</span>
                <div>
                  <div className="doc-name">{d.name}{d.when && <span className="muted" style={{ fontWeight: 400 }}> ({CONDITION_LABEL[d.when]})</span>}</div>
                  {files.length ? <FileLinks files={files} role={role} /> : <div className="doc-file">{d.req ? 'Missing' : 'Not provided (optional)'}</div>}
                </div>
                <span className="small muted">{files.length > 1 ? `${files.length} files` : ''}</span>
              </li>
            );
          })}
        </DocGroup>
      ))}
      {extra.length > 0 && (
        <DocGroup title="Label, payment and query files">
          {extra.map((x) => (
            <li key={x.name}><span className="doc-state ok"><Icon name="check" /></span><div><div className="doc-name">{x.name}</div><FileLinks files={x.files} role={role} /></div><span /></li>
          ))}
        </DocGroup>
      )}
    </ul>
  );
}

function DocGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <><li className="doc-group" style={{ display: 'block' }}>{title}</li>{children}</>;
}

function Payment({ app, role }: { app: ApplicationDto; role: Role }) {
  const openModal = useModal();
  const inv = app.invoice;
  if (!inv) return <p className="muted">No invoice yet.</p>;
  const canPay = role === 'applicant' && app.status === 'awaiting_payment' && (inv.status === 'unpaid' || inv.status === 'rejected');
  return (
    <>
      <dl className="facts">
        <div><dt>Invoice number</dt><dd>{inv.no}</dd></div><div><dt>Amount</dt><dd>{money(inv.amount)}</dd></div><div><dt>Issued</dt><dd>{fmtDate(inv.issuedAt)}</dd></div>
        <div><dt>Status</dt><dd><InvoiceBadge status={inv.status} /></dd></div>
        {inv.proof && <div><dt>Proof of payment</dt><dd><a href={fileUrl(inv.proof.id)} target="_blank" rel="noopener noreferrer">{inv.proof.name}</a></dd></div>}
        {inv.momoRef && <div><dt>Mobile money transaction</dt><dd>{inv.momoRef}</dd></div>}
      </dl>
      <div className="row" style={{ marginTop: 18 }}>
        {canPay && <button className="btn primary" onClick={() => openModal((close) => <PayModal app={app} close={close} />)}>Pay or upload proof</button>}
        <button className="btn" onClick={() => openModal(() => <InvoiceModal app={app} />)}>Print invoice</button>
      </div>
    </>
  );
}

function Queries({ app, role }: { app: ApplicationDto; role: Role }) {
  const open = lastOpenQuery(app);
  return (
    <>
      {app.queries.length ? (
        <div className="thread">
          {app.queries.map((q) => (
            <div key={q.id} className={`msg ${q.from === 'fda' ? 'fda' : 'you'}`}>
              <div className="from">{q.from === 'fda' ? `Rwanda FDA, ${STAGE_NAME[q.stage] || ''}` : app.applicant}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{q.text}</div>
              {q.files.length > 0 && <div className="small" style={{ marginTop: 6 }}>Attached: {q.files.map((f, i) => <span key={f.id}>{i ? ', ' : ''}<a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer">{f.name}</a></span>)}</div>}
              <div className="when">{fmtDateTime(q.at)}</div>
            </div>
          ))}
        </div>
      ) : <p className="muted">No queries on this application.</p>}
      {role === 'applicant' && open && app.status === 'queried' && <ReplyForm app={app} />}
    </>
  );
}

function ReplyForm({ app }: { app: ApplicationDto }) {
  const toast = useToast();
  const { busy, run } = useBusy();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [invalid, setInvalid] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setInvalid(true); document.getElementById('qtext')?.focus(); return; }
    const fd = new FormData();
    fd.append('text', text.trim());
    files.forEach((f) => fd.append('files', f));
    run(async () => {
      storeApp(await api<ApplicationDto>(`/applications/${app.id}/queries/reply`, { body: fd }));
      toast('Response sent. Your application is back with Rwanda FDA.');
    });
  };
  return (
    <form className="stack" style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }} onSubmit={submit}>
      <div className={`field ${invalid ? 'invalid' : ''}`}><label htmlFor="qtext" className="req">Your response</label>
        <textarea id="qtext" placeholder="Answer each point raised" value={text} onChange={(e) => { setText(e.target.value); setInvalid(false); }} /><span className="error">Write a response.</span></div>
      <div className="row"><label className="btn small"><Icon name="upload" /><span>Attach files</span>
        <input type="file" className="sr-only" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>
        <span className="small muted">{files.length ? files.map((f) => f.name).join(', ') : 'No files attached'}</span></div>
      <div><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send response'}</button></div>
    </form>
  );
}

function History({ app }: { app: ApplicationDto }) {
  return (
    <ol className="timeline">
      {[...app.history].reverse().map((e, i) => (
        <li key={i} className={e.by === 'fda' ? 'fda' : ''}>
          <strong>{e.action}</strong>{e.note && <div style={{ whiteSpace: 'pre-wrap' }}>{e.note}</div>}
          <div className="when">{fmtDateTime(e.at)}. {e.by === 'fda' ? 'Rwanda FDA' : app.applicant}</div>
        </li>
      ))}
    </ol>
  );
}

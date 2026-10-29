'use client';
import {
  STAGE_NAME, TYPES, changesSinceFda, docsFor, dueInfo, filesFor, groupDocs, money, type ApplicationDto, type DecisionAction,
} from '@rfda/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { AppTab, Tabs, type TabKey } from '@/components/AppTabs';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/journey';
import { NotFound } from '@/components/NotFound';
import { storeApp } from '@/components/session';
import { useBusy, useToast } from '@/components/ui';
import { api, fetcher, fileUrl } from '@/lib/api';

const TABS: [TabKey, string][] = [['overview', 'Product details'], ['documents', 'Documents'], ['payment', 'Payment'], ['queries', 'Queries'], ['history', 'History']];

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: app, error } = useSWR<ApplicationDto>(`/review/applications/${id}`, fetcher);
  const [tab, setTab] = useState<TabKey | null>(null);
  if (error) return <NotFound back="/intray" />;
  if (!app) return <p className="loading">Loading…</p>;
  const current = tab || (app.stage === 'verification' ? 'payment' : app.stage === 'screening' ? 'documents' : 'overview');
  const due = app.status === 'in_review' ? dueInfo(app) : null;

  return (
    <>
      <div className="crumbs"><Link href="/intray">In-tray</Link> / {app.ref}</div>
      <div className="page-head" style={{ marginBottom: 16 }}><div><h1>{app.brand} <span className="muted" style={{ fontWeight: 500, fontSize: 20 }}>{app.generic}</span></h1></div></div>
      <section className="panel"><dl className="case-bar">
        <div><dt>Tracking number</dt><dd>{app.ref}</dd></div>
        <div><dt>Process</dt><dd>New registration: {TYPES[app.type].short}</dd></div>
        <div><dt>Pathway</dt><dd>{app.srA === 'Yes' ? `Reliance (${app.refAuthority || 'reference authority'})` : 'Full assessment'}</dd></div>
        <div><dt>Current stage</dt><dd>{STAGE_NAME[app.stage]}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge app={app} /></dd></div>
        <div><dt>Deadline</dt><dd>{due ? <span className={`due ${due.cls}`}>{due.text}</span> : '—'}</dd></div>
        <div><dt>Applicant</dt><dd>{app.applicant}<div className="small muted" style={{ fontWeight: 400 }}>{app.applicantAddress}</div></dd></div>
      </dl></section>
      <div className="workspace">
        <section className="panel"><Tabs tabs={TABS} tab={current} setTab={setTab} app={app} /><div className="panel-pad" role="tabpanel"><AppTab app={app} tab={current} role="fda" /></div></section>
        <aside className="decision stack"><DecisionPanel app={app} /></aside>
      </div>
    </>
  );
}

function DecisionPanel({ app }: { app: ApplicationDto }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useBusy();
  const [comment, setComment] = useState('');
  const [findings, setFindings] = useState('');
  const [needComment, setNeedComment] = useState(false);

  if (app.status !== 'in_review') {
    const msg = { queried: 'Waiting for the applicant to answer a query.', awaiting_payment: 'Waiting for the applicant to pay the invoice.', approved: `Registered. Certificate ${app.certNo}.`, rejected: 'Rejected.', draft: '' }[app.status];
    return <div className="panel panel-pad"><h3>No action needed</h3><p className="muted" style={{ marginTop: 6 }}>{msg}</p></div>;
  }

  const decide = (action: DecisionAction, requireComment = false) => {
    if (requireComment && !comment.trim()) { setNeedComment(true); document.getElementById('dcomment')?.focus(); return; }
    run(async () => {
      const res = await api<{ app: ApplicationDto; message: string }>(`/review/applications/${app.id}/decision`, { body: { action, comment: comment.trim() || undefined, findings: findings.trim() || undefined } });
      storeApp(res.app, 'assessor');
      toast(res.message);
      router.push('/intray');
    });
  };

  const answered = app.history.some((e, i) => e.action === 'Query answered' && !app.history.slice(i).some((x) => x.by === 'fda'));
  const changes = changesSinceFda(app.history);
  const commentField = (
    <>
      {answered && <div className="notice gold"><strong>The applicant answered your query</strong><p className="small">Read the response in the Queries tab before deciding.</p></div>}
      {changes.length > 0 && <div className="notice gold"><strong>The applicant changed the application since Rwanda FDA last acted</strong>
        <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{changes.map((c, i) => <li key={i}>{c.note}</li>)}</ul>
        <p className="small" style={{ marginTop: 6 }}>Changed documents have been unticked in the screening checklist. Full detail is in the History tab.</p></div>}
      <div className={`field ${needComment ? 'invalid' : ''}`}><label htmlFor="dcomment">Comment for the record</label>
        <textarea id="dcomment" placeholder="Required when raising a query or rejecting" value={comment} onChange={(e) => { setComment(e.target.value); setNeedComment(false); }} />
        <span className="error">Add a comment explaining your decision.</span></div>
    </>
  );

  if (app.stage === 'verification') {
    const inv = app.invoice!;
    return (
      <div className="panel panel-pad stack"><h3>Verify payment</h3>
        <dl className="facts" style={{ gridTemplateColumns: '1fr 1fr' }}><div><dt>Invoice</dt><dd>{inv.no}</dd></div><div><dt>Amount</dt><dd>{money(inv.amount)}</dd></div>
          <div><dt>Proof</dt><dd>{inv.proof ? <a href={fileUrl(inv.proof.id)} target="_blank" rel="noopener noreferrer">{inv.proof.name}</a> : inv.momoRef ? `Mobile money ${inv.momoRef}` : 'None'}</dd></div></dl>
        {commentField}
        <button className="btn primary" disabled={busy} onClick={() => decide('pay-ok')}>Confirm payment and send to screening</button>
        <button className="btn danger" disabled={busy} onClick={() => decide('pay-bad', true)}>Payment not received</button>
      </div>
    );
  }
  if (app.stage === 'screening') {
    return (
      <div className="panel panel-pad stack"><h3>Screen for completeness</h3>
        <p className="small muted">Open and tick each document you’ve checked. Missing or unacceptable items go back to the applicant as one query.</p>
        <ScreeningChecklist app={app} />
        <AiSlot stage="screening" />
        {commentField}
        <button className="btn primary" disabled={busy} onClick={() => decide('accept')}>Accept for assessment</button>
        <button className="btn gold" disabled={busy} onClick={() => decide('query', true)}>Raise query to applicant</button>
      </div>
    );
  }
  if (app.stage === 'assessment') {
    return (
      <div className="panel panel-pad stack"><h3>Assessment</h3>
        <AiSlot stage="assessment" />
        <div className="field"><label htmlFor="dfind">Assessment findings</label>
          <textarea id="dfind" style={{ minHeight: 120 }} placeholder="Quality (Module 3), non-clinical (Module 4), clinical (Module 5), labelling. These become the assessment report." value={findings} onChange={(e) => setFindings(e.target.value)} /></div>
        {commentField}
        <button className="btn primary" disabled={busy} onClick={() => decide('rec-approve')}>Recommend approval</button>
        <button className="btn gold" disabled={busy} onClick={() => decide('query', true)}>Raise query to applicant</button>
        <button className="btn danger" disabled={busy} onClick={() => decide('rec-reject', true)}>Recommend rejection</button>
      </div>
    );
  }
  if (app.stage === 'approval') {
    const rec = app.history.filter((e) => e.stage === 'assessment').pop();
    return (
      <div className="panel panel-pad stack"><h3>Final decision</h3>
        <div className={`notice ${app.recommendation === 'reject' ? 'red' : 'sky'}`}><strong>Assessor recommends {app.recommendation === 'reject' ? 'rejection' : 'approval'}</strong><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{rec?.note}</p></div>
        {commentField}
        <button className="btn primary" disabled={busy} onClick={() => decide('approve')}>Approve and issue certificate</button>
        <button className="btn" disabled={busy} onClick={() => decide('return', true)}>Return to assessment</button>
        <button className="btn danger" disabled={busy} onClick={() => decide('reject', true)}>Reject application</button>
      </div>
    );
  }
  return null;
}

/** Every applicable requirement, grouped; ticks are saved so screening can be done over several sittings. */
function ScreeningChecklist({ app }: { app: ApplicationDto }) {
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const docs = docsFor(app);
  const toggle = async (requirementId: string, checked: boolean) => {
    setSaving(requirementId);
    try { storeApp(await api<ApplicationDto>(`/review/applications/${app.id}/checks/${requirementId}`, { method: 'PUT', body: { checked } }), 'assessor'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save the tick.'); }
    finally { setSaving(null); }
  };
  const present = docs.filter((d) => filesFor(app, d.id).length);
  const ticked = present.filter((d) => app.checks.includes(d.id)).length;
  return (
    <div>
      <p className="small" style={{ fontWeight: 600 }}>{ticked} of {present.length} uploaded documents checked</p>
      {groupDocs(docs).map(([group, items]) => (
        <div key={group} style={{ marginTop: 12 }}>
          <p className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>{group}</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((d) => {
              const files = filesFor(app, d.id);
              return (
                <li key={d.id}><label className="check">
                  <input type="checkbox" checked={app.checks.includes(d.id)} disabled={!files.length || saving === d.id} onChange={(e) => toggle(d.id, e.target.checked)} />
                  <span className="small">{d.name}
                    {!files.length && (d.req ? <strong style={{ color: 'var(--red)' }}> (missing)</strong> : <span className="muted"> (not provided)</span>)}
                    {files.length > 0 && <span className="muted"> · {files.map((f, i) => <span key={f.id}>{i ? ', ' : ''}<a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer">{files.length > 1 ? `file ${i + 1}` : 'open'}</a></span>)}</span>}
                  </span></label></li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AiSlot({ stage }: { stage: 'screening' | 'assessment' }) {
  return (
    <div className="ai-slot"><div className="row"><span className="ai-tag"><Icon name="spark" /> AI assist</span><span className="small muted">Coming soon</span></div>
      <p className="small" style={{ marginTop: 8 }}>{stage === 'screening'
        ? 'Planned: checks that each uploaded file is the document it claims to be and is still valid, and drafts the query for anything missing.'
        : 'Planned: evaluates the dossier and label against each guideline rule, with quoted evidence and page references. The assessor confirms or overrides every finding.'}</p>
      <button className="btn small" style={{ marginTop: 10 }} disabled>Request AI analysis</button></div>
  );
}

'use client';
import { fileSize, fmtDateTime, type AiAnalysisDto, type AiFinding, type ApplicationDto } from '@rfda/shared';
import useSWR from 'swr';
import { api, fetcher, fileUrl } from '@/lib/api';
import { Icon } from './Icon';
import { useBusy, useToast } from './ui';

const STATUS_BADGE: Record<AiFinding['status'], [string, string]> = {
  fail: ['bad', 'Fail'], unclear: ['you', 'Unclear'], pass: ['ok', 'Pass'], not_applicable: ['draft', 'Not applicable'],
};
const VERDICT: Record<Audience, Record<string, [string, string]>> = {
  assessor: { non_compliant: ['bad', 'Likely non-compliant'], needs_review: ['you', 'Needs review'], compliant: ['ok', 'No issues found'] },
  applicant: { non_compliant: ['bad', 'Likely to be queried'], needs_review: ['you', 'Some points to check'], compliant: ['ok', 'No issues found'] },
};

/** Assessors run the internal AI review; applicants run a pre-check of their own application. Neither sees the other's. */
export type Audience = 'assessor' | 'applicant';
const endpoint = (audience: Audience, appId: string) => (audience === 'assessor' ? `/review/applications/${appId}/ai-analyses` : `/applications/${appId}/ai-checks`);

/** The application's AI analyses, newest first. Refreshes every 5 s while one is running. */
export function useAiAnalyses(appId: string, audience: Audience = 'assessor') {
  return useSWR<AiAnalysisDto[]>(endpoint(audience, appId), fetcher, {
    refreshInterval: (data) => (data?.[0] && ['requesting', 'running'].includes(data[0].status) ? 5000 : 0),
  });
}

function useRequestAnalysis(appId: string, audience: Audience, beforeRequest?: () => Promise<unknown>) {
  const toast = useToast();
  const { busy, run } = useBusy();
  const { mutate } = useAiAnalyses(appId, audience);
  const request = () => run(async () => {
    if (beforeRequest) await beforeRequest();
    await api(endpoint(audience, appId), { method: 'POST' });
    await mutate();
    toast(audience === 'assessor' ? 'Documents sent for AI review. Results usually take under a minute.' : 'Your application is being checked. Results usually take under a minute.');
  });
  return { busy, request };
}

/** Compact status and request button for the decision panel. */
export function AiSummary({ app, onOpen }: { app: ApplicationDto; onOpen: () => void }) {
  const { data } = useAiAnalyses(app.id);
  const { busy, request } = useRequestAnalysis(app.id, 'assessor');
  const latest = data?.[0];
  const running = latest && ['requesting', 'running'].includes(latest.status);
  const counts = latest?.result?.overall.counts;
  return (
    <div className="ai-slot">
      <div className="row"><span className="ai-tag"><Icon name="spark" /> AI review</span><span className="small muted">Advice only</span></div>
      {!latest && <p className="small" style={{ marginTop: 8 }}>Checks the dossier and label against the approved rules, with quoted evidence. You confirm or override every finding.</p>}
      {running && <p className="small" style={{ marginTop: 8 }}><strong>Analysing…</strong> started {fmtDateTime(latest.createdAt)}. This page updates by itself.</p>}
      {latest?.status === 'failed' && <p className="small" style={{ marginTop: 8, color: 'var(--red)' }}><strong>The last analysis failed.</strong> {latest.error}</p>}
      {latest?.status === 'completed' && latest.verdict && counts && (
        <div style={{ marginTop: 8 }}>
          <span className={`badge ${VERDICT.assessor[latest.verdict][0]}`}>{VERDICT.assessor[latest.verdict][1]}</span>
          <p className="small" style={{ marginTop: 6 }}>{counts.fail} failed, {counts.unclear} unclear, {counts.pass} passed{counts.skipped ? `, ${counts.skipped} not checked` : ''}. {fmtDateTime(latest.finishedAt)}.</p>
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        {latest?.status === 'completed' && <button className="btn small primary" onClick={onOpen}>View findings</button>}
        <button className="btn small" disabled={busy || running} onClick={request}>{latest ? 'Run again' : 'Request AI analysis'}</button>
      </div>
    </div>
  );
}

/**
 * Full findings: the assessor's "AI review" tab, or the applicant's pre-check.
 * `onUseSuggestion` (assessors) adds a finding's suggestion to the query being drafted.
 */
export function AiFindings({ app, audience = 'assessor', onUseSuggestion, beforeRequest }: {
  app: ApplicationDto; audience?: Audience; onUseSuggestion?: (text: string) => void; beforeRequest?: () => Promise<unknown>;
}) {
  const { data, error } = useAiAnalyses(app.id, audience);
  const { busy, request } = useRequestAnalysis(app.id, audience, beforeRequest);
  const isA = audience === 'applicant';
  if (error) return <p className="muted">AI results could not be loaded.</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const latest = data[0];
  const running = latest && ['requesting', 'running'].includes(latest.status);
  const requestButton = <button className="btn small" disabled={busy || running} onClick={request}>{latest ? (isA ? 'Check again' : 'Run again') : (isA ? 'Run AI pre-check' : 'Request AI analysis')}</button>;

  if (!latest) return <div className="stack"><p className="muted">{isA ? 'Not checked yet.' : 'No AI analysis yet for this application.'}</p><div>{requestButton}</div></div>;
  if (running) return <p><strong>{isA ? 'Checking…' : 'Analysing…'}</strong> <span className="muted">Started {fmtDateTime(latest.createdAt)}{isA ? '' : ` by ${latest.requestedBy}`}. Results appear here automatically.</span></p>;
  if (latest.status === 'failed' || !latest.result) {
    return <div className="stack"><div className="notice red"><strong>{isA ? 'The check could not be completed' : 'The AI analysis failed'}</strong><p className="small">{isA ? 'Please try again later. If it keeps failing, contact the help desk.' : latest.error}</p></div><div>{requestButton}</div></div>;
  }

  const r = latest.result;
  const attention = r.findings.filter((f) => f.status === 'fail' || f.status === 'unclear');
  const fine = r.findings.filter((f) => f.status === 'pass' || f.status === 'not_applicable');
  const unreadable = r.documents.filter((d) => d.noText || d.truncated);
  return (
    <div className="stack">
      <div className="row">
        <span className={`badge ${VERDICT[audience][r.overall.verdict][0]}`}>{VERDICT[audience][r.overall.verdict][1]}</span>
        <span className="small muted">{r.summary} {isA ? 'Checked' : `Requested by ${latest.requestedBy},`} {fmtDateTime(latest.finishedAt)}.</span>
        <span className="spacer" />{requestButton}
      </div>
      <p className="small muted">{isA
        ? 'Automatic advice to help you avoid queries. It does not approve or reject anything: Rwanda FDA assessors review every application.'
        : 'AI advice from the approved rules. Check each quote in the document before relying on a finding; the decision is yours.'}</p>
      {latest.notSent.length > 0 && <div className="notice gold"><strong>Not sent for analysis (over the size limit)</strong>
        <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{latest.notSent.map((f, i) => <li key={i}>{f.fileName} ({fileSize(f.size)})</li>)}</ul></div>}
      {unreadable.length > 0 && <div className="notice gold"><strong>Some documents could not be fully read</strong>
        <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{unreadable.map((d, i) => <li key={i}>{d.fileName}: {d.noText ? 'no text found (scanned image?)' : 'only the first part was analysed'}</li>)}</ul></div>}

      <h3>{attention.length ? `${isA ? 'Points to check' : 'Needs attention'} (${attention.length})` : 'Nothing needs attention'}</h3>
      {attention.map((f) => <FindingCard key={f.ruleCode} f={f} app={app} audience={audience} onUseSuggestion={onUseSuggestion} />)}
      {fine.length > 0 && (
        <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Passed or not applicable ({fine.length})</summary>
          <div className="stack" style={{ marginTop: 12 }}>{fine.map((f) => <FindingCard key={f.ruleCode} f={f} app={app} audience={audience} onUseSuggestion={onUseSuggestion} />)}</div></details>
      )}
      {r.skipped.length > 0 && (
        <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Not checked ({r.skipped.length})</summary>
          {isA && <p className="small muted" style={{ marginTop: 6 }}>These need documents you haven’t uploaded yet.</p>}
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>{r.skipped.map((s) => <li key={s.ruleCode}><strong>{s.ruleCode}</strong> {s.rule} <span className="muted">{s.reason}</span></li>)}</ul></details>
      )}
      {data.length > 1 && <p className="small muted">{data.length - 1} earlier {isA ? 'check' : 'analysis'}{data.length > 2 ? (isA ? 's' : 'es') : ''} kept for the record.</p>}
    </div>
  );
}

function FindingCard({ f, app, audience, onUseSuggestion }: { f: AiFinding; app: ApplicationDto; audience: Audience; onUseSuggestion?: (text: string) => void }) {
  const [cls, label] = STATUS_BADGE[f.status];
  // Link each quote to the uploaded file it came from.
  const fileFor = (requirementId: string | null, name: string | null) => app.files.find((x) => x.requirementId === requirementId && x.name === name);
  return (
    <article className="panel" style={{ padding: '14px 16px' }}>
      <div className="row" style={{ gap: 8 }}><span className={`badge ${cls}`}>{label}</span><strong>{f.ruleCode}</strong><span className="tag">{f.severity}</span>
        <span className="spacer" /><span className="small muted">confidence {Math.round(f.confidence * 100)}%</span></div>
      <p className="small" style={{ marginTop: 6, fontWeight: 600 }}>{f.rule}</p>
      {f.explanation && <p className="small" style={{ marginTop: 4 }}>{f.explanation}</p>}
      {f.evidence.length > 0 && (
        <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {f.evidence.map((e, i) => {
            const file = fileFor(e.requirementId, e.document);
            const where = `${e.document || 'document'}${e.page ? `, page ${e.page}` : ''}`;
            return (
              <li key={i}>“{e.quote}” <span className="muted">({file ? <a href={fileUrl(file.id)} target="_blank" rel="noopener noreferrer">{where}</a> : where}{e.verified ? '' : ', quote not found in the document'})</span></li>
            );
          })}
        </ul>
      )}
      {f.kbReferences.length > 0 && <p className="small muted" style={{ marginTop: 6 }}>Based on: {f.kbReferences.map((k) => k.title).join('; ')}</p>}
      {f.checks.notes.length > 0 && <p className="small muted" style={{ marginTop: 6 }}>{f.checks.notes.join(' ')}</p>}
      {f.suggestion && (
        <div className="row" style={{ marginTop: 8 }}>
          <p className="small" style={{ flex: 1 }}><strong>{audience === 'applicant' ? 'What to do:' : 'Suggested query:'}</strong> {f.suggestion}</p>
          {onUseSuggestion && <button className="btn small" onClick={() => onUseSuggestion(f.suggestion)}>Add to query</button>}
        </div>
      )}
    </article>
  );
}

/** The applicant's AI pre-check, shown in the last step of the application form. */
export function AiPrecheck({ app, beforeRequest }: { app: ApplicationDto; beforeRequest?: () => Promise<unknown> }) {
  return (
    <div className="ai-slot">
      <div className="row"><span className="ai-tag"><Icon name="spark" /> AI pre-check</span><span className="small muted">Optional</span></div>
      <p style={{ marginTop: 8 }}><strong>Check my application against Rwanda FDA requirements</strong></p>
      <p className="small muted" style={{ marginBottom: 12 }}>Points out likely queries before Rwanda FDA sees your application, such as a label without a storage temperature. Advice only: assessors still review everything.</p>
      <AiFindings app={app} audience="applicant" beforeRequest={beforeRequest} />
    </div>
  );
}

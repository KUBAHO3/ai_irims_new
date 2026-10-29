'use client';
import { fileSize, fmtDateTime, type AiAnalysisDto, type AiFinding, type ApplicationDto } from '@rfda/shared';
import useSWR from 'swr';
import { api, fetcher, fileUrl } from '@/lib/api';
import { Icon } from './Icon';
import { useBusy, useToast } from './ui';

const STATUS_BADGE: Record<AiFinding['status'], [string, string]> = {
  fail: ['bad', 'Fail'], unclear: ['you', 'Unclear'], pass: ['ok', 'Pass'], not_applicable: ['draft', 'Not applicable'],
};
const VERDICT: Record<string, [string, string]> = {
  non_compliant: ['bad', 'Likely non-compliant'], needs_review: ['you', 'Needs review'], compliant: ['ok', 'No issues found'],
};

/** The application's AI analyses, newest first. Refreshes every 5 s while one is running. */
export function useAiAnalyses(appId: string) {
  return useSWR<AiAnalysisDto[]>(`/review/applications/${appId}/ai-analyses`, fetcher, {
    refreshInterval: (data) => (data?.[0] && ['requesting', 'running'].includes(data[0].status) ? 5000 : 0),
  });
}

function useRequestAnalysis(appId: string) {
  const toast = useToast();
  const { busy, run } = useBusy();
  const { mutate } = useAiAnalyses(appId);
  const request = () => run(async () => {
    await api(`/review/applications/${appId}/ai-analyses`, { method: 'POST' });
    await mutate();
    toast('Documents sent for AI review. Results usually take under a minute.');
  });
  return { busy, request };
}

/** Compact status and request button for the decision panel. */
export function AiSummary({ app, onOpen }: { app: ApplicationDto; onOpen: () => void }) {
  const { data } = useAiAnalyses(app.id);
  const { busy, request } = useRequestAnalysis(app.id);
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
          <span className={`badge ${VERDICT[latest.verdict][0]}`}>{VERDICT[latest.verdict][1]}</span>
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

/** Full findings, for the "AI review" tab. */
export function AiFindings({ app, onUseSuggestion }: { app: ApplicationDto; onUseSuggestion: (text: string) => void }) {
  const { data, error } = useAiAnalyses(app.id);
  const { busy, request } = useRequestAnalysis(app.id);
  if (error) return <p className="muted">AI results could not be loaded.</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const latest = data[0];
  const running = latest && ['requesting', 'running'].includes(latest.status);
  const requestButton = <button className="btn small" disabled={busy || running} onClick={request}>{latest ? 'Run again' : 'Request AI analysis'}</button>;

  if (!latest) return <div className="stack"><p className="muted">No AI analysis yet for this application.</p><div>{requestButton}</div></div>;
  if (running) return <p><strong>Analysing…</strong> <span className="muted">Started {fmtDateTime(latest.createdAt)} by {latest.requestedBy}. Results appear here automatically.</span></p>;
  if (latest.status === 'failed' || !latest.result) {
    return <div className="stack"><div className="notice red"><strong>The AI analysis failed</strong><p className="small">{latest.error}</p></div><div>{requestButton}</div></div>;
  }

  const r = latest.result;
  const attention = r.findings.filter((f) => f.status === 'fail' || f.status === 'unclear');
  const fine = r.findings.filter((f) => f.status === 'pass' || f.status === 'not_applicable');
  const unreadable = r.documents.filter((d) => d.noText || d.truncated);
  return (
    <div className="stack">
      <div className="row">
        <span className={`badge ${VERDICT[r.overall.verdict][0]}`}>{VERDICT[r.overall.verdict][1]}</span>
        <span className="small muted">{r.summary} Requested by {latest.requestedBy}, {fmtDateTime(latest.finishedAt)}.</span>
        <span className="spacer" />{requestButton}
      </div>
      <p className="small muted">AI advice from the approved rules. Check each quote in the document before relying on a finding; the decision is yours.</p>
      {latest.notSent.length > 0 && <div className="notice gold"><strong>Not sent for analysis (over the size limit)</strong>
        <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{latest.notSent.map((f, i) => <li key={i}>{f.fileName} ({fileSize(f.size)})</li>)}</ul></div>}
      {unreadable.length > 0 && <div className="notice gold"><strong>Some documents could not be fully read</strong>
        <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{unreadable.map((d, i) => <li key={i}>{d.fileName}: {d.noText ? 'no text found (scanned image?)' : 'only the first part was analysed'}</li>)}</ul></div>}

      <h3>{attention.length ? `Needs attention (${attention.length})` : 'Nothing needs attention'}</h3>
      {attention.map((f) => <FindingCard key={f.ruleCode} f={f} app={app} onUseSuggestion={onUseSuggestion} />)}
      {fine.length > 0 && (
        <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Passed or not applicable ({fine.length})</summary>
          <div className="stack" style={{ marginTop: 12 }}>{fine.map((f) => <FindingCard key={f.ruleCode} f={f} app={app} onUseSuggestion={onUseSuggestion} />)}</div></details>
      )}
      {r.skipped.length > 0 && (
        <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Not checked ({r.skipped.length})</summary>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>{r.skipped.map((s) => <li key={s.ruleCode}><strong>{s.ruleCode}</strong> {s.rule} <span className="muted">{s.reason}</span></li>)}</ul></details>
      )}
      {data.length > 1 && <p className="small muted">{data.length - 1} earlier analysis{data.length > 2 ? 'es' : ''} kept for the record.</p>}
    </div>
  );
}

function FindingCard({ f, app, onUseSuggestion }: { f: AiFinding; app: ApplicationDto; onUseSuggestion: (text: string) => void }) {
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
          <p className="small" style={{ flex: 1 }}><strong>Suggested query:</strong> {f.suggestion}</p>
          <button className="btn small" onClick={() => onUseSuggestion(f.suggestion)}>Add to query</button>
        </div>
      )}
    </article>
  );
}

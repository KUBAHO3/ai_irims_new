'use client';
import { FDA_STAGES, STAGE_NAME, TYPES, changesSinceFda, dueInfo, fmtDate, type ApplicationDto, type Stage } from '@rfda/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAllApps } from '@/components/session';

export default function Intray() {
  const router = useRouter();
  const { data } = useAllApps();
  const [stage, setStage] = useState<Stage | ''>('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  if (!data) return <p className="loading">Loading…</p>;

  const active = data.filter((a) => a.status === 'in_review');
  const waiting = data.filter((a) => a.status === 'queried' || a.status === 'awaiting_payment');
  const over = active.filter((a) => dueInfo(a).d < 0).length;
  const soon = active.filter((a) => { const d = dueInfo(a).d; return d >= 0 && d <= 7; }).length;
  const term = q.trim().toLowerCase();
  const rows = active.filter((a) => (!stage || a.stage === stage) && (!type || a.type === type) && (!term || `${a.ref} ${a.brand} ${a.applicant}`.toLowerCase().includes(term)))
    .sort((a, b) => dueInfo(a).d - dueInfo(b).d);
  const lastAction = (a: ApplicationDto) => a.history[a.history.length - 1]?.action;

  return (
    <>
      <div className="page-head"><div><h1>In-tray</h1><p className="sub">Applications waiting for Rwanda FDA, oldest deadline first.</p></div></div>
      <div className="kpis">
        <div className="kpi"><b>{active.length}</b><span>Active applications</span></div>
        <div className="kpi alert"><b>{over}</b><span>Past their stage deadline</span></div>
        <div className="kpi warn"><b>{soon}</b><span>Due within 7 days</span></div>
        <div className="kpi"><b>{waiting.length}</b><span>Waiting for applicants</span></div>
      </div>
      <div className="workspace" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', marginTop: 0 }}>
        <div className="panel">
          <div className="toolbar">
            <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value as Stage | '')}><option value="">All stages</option>{FDA_STAGES.map((s) => <option key={s} value={s}>{STAGE_NAME[s]}</option>)}</select>
            <select aria-label="Product type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All product types</option>{Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select>
            <input type="search" placeholder="Tracking number, product or applicant" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="table-wrap"><table><thead><tr><th>Deadline</th><th>Tracking number</th><th>Product</th><th>Applicant</th><th>Stage</th><th>In stage since</th></tr></thead><tbody>
            {rows.length ? rows.map((a) => {
              const d = dueInfo(a);
              const go = () => router.push(`/review/${a.id}`);
              return (
                <tr key={a.id} className="clickable" tabIndex={0} onClick={go} onKeyDown={(e) => { if (e.key === 'Enter') go(); }}>
                  <td><span className={`due ${d.cls}`}>{d.text}</span>{a.urgent && <div className="small" style={{ color: 'var(--red)', fontWeight: 600 }}>Urgent</div>}</td>
                  <td className="ref">{a.ref}</td>
                  <td><strong>{a.brand}</strong><div className="small muted">{TYPES[a.type].short}, {a.category}</div></td>
                  <td>{a.applicant}</td>
                  <td>{STAGE_NAME[a.stage]}
                    {lastAction(a) === 'Query answered' && <div className="small" style={{ color: 'var(--gold)', fontWeight: 600 }}>Query answered</div>}
                    {changesSinceFda(a.history).length > 0 && <div className="small" style={{ color: 'var(--gold)', fontWeight: 600 }}>Changed by applicant</div>}
                    {a.recommendation && <div className="small muted">Recommended: {a.recommendation}</div>}</td>
                  <td className="small">{fmtDate(a.stageAt)}</td>
                </tr>
              );
            }) : <tr><td colSpan={6} className="empty">Nothing matches these filters.</td></tr>}
          </tbody></table></div>
        </div>
        <aside className="panel">
          <div className="panel-head"><h3>By stage</h3></div>
          <table className="stage-summary"><tbody>{FDA_STAGES.map((s) => <tr key={s} className="clickable" onClick={() => setStage(s)}><td>{STAGE_NAME[s]}</td><td><strong>{active.filter((a) => a.stage === s).length}</strong></td></tr>)}</tbody></table>
          <div className="panel-head" style={{ borderTop: '1px solid var(--line)' }}><h3>Waiting for applicants</h3></div>
          <ul className="action-list">
            {waiting.length ? waiting.map((a) => (
              <li key={a.id} style={{ padding: '12px 18px', gridTemplateColumns: '6px minmax(0,1fr)' }}><span className={`bar ${a.status === 'queried' ? 'red' : ''}`} />
                <div><Link className="ref" href={`/review/${a.id}`}>{a.ref}</Link><div className="meta">{a.status === 'queried' ? 'Query open since ' + fmtDate(a.queriedAt) : 'Invoice unpaid since ' + fmtDate(a.stageAt)}</div></div></li>
            )) : <li className="empty" style={{ display: 'block' }}>None</li>}
          </ul>
        </aside>
      </div>
    </>
  );
}

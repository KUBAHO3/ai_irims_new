'use client';
import { TYPES, fmtDate } from '@rfda/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RailMini, StatusBadge } from '@/components/journey';
import { useAllApps } from '@/components/session';

export default function Enquiries() {
  const router = useRouter();
  const { data } = useAllApps();
  const [q, setQ] = useState('');
  if (!data) return <p className="loading">Loading…</p>;
  const term = q.trim().toLowerCase();
  const rows = data.filter((a) => !term || `${a.ref} ${a.brand} ${a.applicant}`.toLowerCase().includes(term));
  return (
    <>
      <div className="page-head"><div><h1>Application enquiries</h1><p className="sub">Look up any submitted application, in any state.</p></div></div>
      <div className="panel"><div className="toolbar"><input type="search" placeholder="Tracking number, product or applicant" aria-label="Search" style={{ maxWidth: 360 }} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="table-wrap"><table><thead><tr><th>Tracking number</th><th>Product</th><th>Applicant</th><th>Progress</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
          {rows.length ? rows.map((a) => (
            <tr key={a.id} className="clickable" tabIndex={0} onClick={() => router.push(`/review/${a.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/review/${a.id}`); }}>
              <td className="ref">{a.ref}</td><td><strong>{a.brand}</strong><div className="small muted">{TYPES[a.type].short}</div></td><td>{a.applicant}</td>
              <td><RailMini app={a} /></td><td><StatusBadge app={a} /></td><td className="small">{fmtDate(a.submittedAt)}</td>
            </tr>
          )) : <tr><td colSpan={6} className="empty">No application matches.</td></tr>}
        </tbody></table></div></div>
    </>
  );
}

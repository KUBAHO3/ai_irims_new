'use client';
import { TYPES, fmtDate, groupOf } from '@rfda/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Icon } from '@/components/Icon';
import { RailMini, StatusBadge } from '@/components/journey';
import { useMyApps } from '@/components/session';
import { countByGroup, GROUPS, type GroupKey } from '@/lib/filters';

export default function ApplicationsPage() {
  return <Suspense><Applications /></Suspense>;
}

function Applications() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: apps } = useMyApps();
  const [filter, setFilter] = useState<GroupKey>((GROUPS.find(([k]) => k === params.get('filter'))?.[0]) || 'all');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  if (!apps) return <p className="loading">Loading…</p>;

  const counts = countByGroup(apps);
  const term = q.trim().toLowerCase();
  const rows = apps.filter((a) => (filter === 'all' || groupOf(a.status) === filter) && (!type || a.type === type) && (!term || `${a.ref} ${a.brand} ${a.generic}`.toLowerCase().includes(term)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const href = (a: (typeof apps)[number]) => a.status === 'draft' ? `/applications/${a.id}/edit` : `/applications/${a.id}`;

  return (
    <>
      <div className="page-head"><div><h1>My applications</h1><p className="sub">Every product application you’ve started or submitted.</p></div><span className="spacer" /><Link className="btn primary" href="/applications/new"><Icon name="plus" />Start an application</Link></div>
      <div className="panel">
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Filter by status">{GROUPS.map(([k, l]) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <b>{counts[k]}</b></button>)}</div>
          <span className="spacer" />
          <select aria-label="Product type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All product types</option>{Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select>
          <input type="search" placeholder="Search name or tracking number" aria-label="Search applications" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap"><table><thead><tr><th>Tracking number</th><th>Product</th><th>Type</th><th>Progress</th><th>Status</th><th>Last update</th></tr></thead><tbody>
          {rows.length ? rows.map((a) => (
            <tr key={a.id} className="clickable" tabIndex={0} onClick={() => router.push(href(a))} onKeyDown={(e) => { if (e.key === 'Enter') router.push(href(a)); }}>
              <td className="ref">{a.isDraft ? <span className="muted">Not yet assigned</span> : a.ref}</td>
              <td><strong>{a.brand || 'Untitled'}</strong><div className="small muted">{a.generic}</div></td>
              <td>{TYPES[a.type].short}</td><td><RailMini app={a} /></td><td><StatusBadge app={a} /></td><td className="small">{fmtDate(a.updatedAt)}</td>
            </tr>
          )) : <tr><td colSpan={6} className="empty">No applications match these filters. <button className="btn link" onClick={() => { setFilter('all'); setType(''); setQ(''); }}>Clear filters</button></td></tr>}
        </tbody></table></div>
      </div>
    </>
  );
}

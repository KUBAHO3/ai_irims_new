'use client';
import { DAY, TYPES, fmtDate, lastOpenQuery, money, truncate } from '@rfda/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { JourneyRail } from '@/components/journey';
import { NextAction } from '@/components/NextAction';
import { useMe, useMyApps } from '@/components/session';
import { useToast } from '@/components/ui';
import { countByGroup, GROUPS } from '@/lib/filters';

export default function Dashboard() {
  const me = useMe();
  const toast = useToast();
  const { data: apps } = useMyApps();
  if (!apps) return <p className="loading">Loading…</p>;

  const todo: { key: string; bar: string; title: string; meta: ReactNode; btn: ReactNode }[] = [];
  apps.filter((a) => a.status === 'queried').forEach((a) => todo.push({ key: a.id, bar: 'red', title: `Answer the query on ${a.brand}`, meta: `${a.ref}. ${truncate(lastOpenQuery(a)?.text, 120)}`, btn: <NextAction app={a} /> }));
  apps.filter((a) => a.status === 'awaiting_payment').forEach((a) => todo.push({ key: a.id, bar: '', title: `Pay invoice ${a.invoice?.no} for ${a.brand}`, meta: `${money(a.invoice?.amount)}. Assessment starts after payment is confirmed.`, btn: <NextAction app={a} /> }));
  apps.filter((a) => a.status === 'draft').forEach((a) => todo.push({ key: a.id, bar: 'grey', title: `Finish your draft: ${a.brand || 'untitled product'}`, meta: `${TYPES[a.type].short}, ${a.category}. Last saved ${fmtDate(a.updatedAt)}.`, btn: <Link className="btn" href={`/applications/${a.id}/edit`}>Continue</Link> }));
  apps.filter((a) => a.status === 'approved' && a.expiresAt && (new Date(a.expiresAt).getTime() - Date.now()) / DAY < 90).forEach((a) => todo.push({
    key: a.id + '-renew', bar: 'grey', title: `Renew ${a.brand} before ${fmtDate(a.expiresAt)}`, meta: `Registration ${a.certNo} expires in ${Math.ceil((new Date(a.expiresAt!).getTime() - Date.now()) / DAY)} days.`,
    btn: <button className="btn" onClick={() => toast('Online renewal is not available yet. Contact the help desk to renew.')}>Start renewal</button>,
  }));
  const withFda = apps.filter((a) => a.status === 'in_review');
  const counts = countByGroup(apps);

  return (
    <>
      <div className="page-head"><div><h1>Muraho, {me.name}</h1><p className="sub">{todo.length ? `${todo.length} thing${todo.length > 1 ? 's' : ''} need${todo.length > 1 ? '' : 's'} your action.` : 'Nothing needs your action right now.'}</p></div><span className="spacer" /><Link className="btn primary" href="/applications/new"><Icon name="plus" />Start an application</Link></div>
      <section className="panel" aria-labelledby="todo-h"><div className="panel-head"><h2 id="todo-h">Needs your action</h2></div>
        {todo.length ? <ul className="action-list">{todo.map((t) => <li key={t.key}><span className={`bar ${t.bar}`} /><div><div className="title">{t.title}</div><div className="meta">{t.meta}</div></div>{t.btn}</li>)}</ul>
          : <p className="empty">You’re up to date. Start a new application whenever you’re ready.</p>}
      </section>
      <section style={{ marginTop: 28 }} aria-labelledby="fda-h">
        <div className="row" style={{ marginBottom: 12 }}><h2 id="fda-h">With Rwanda FDA</h2><span className="spacer" /><Link className="btn link" href="/applications">All applications</Link></div>
        {withFda.length ? withFda.map((a) => (
          <article key={a.id} className="panel panel-pad" style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 16 }}><div><Link className="ref" href={`/applications/${a.id}`}>{a.ref}</Link><h3 style={{ marginTop: 2 }}>{a.brand} <span className="muted" style={{ fontWeight: 500 }}>{a.generic}, {TYPES[a.type].short}</span></h3></div></div>
            <JourneyRail app={a} />
          </article>
        )) : <div className="panel empty">No applications are with Rwanda FDA right now.</div>}
      </section>
      <section style={{ marginTop: 28 }}><h2 style={{ marginBottom: 12 }}>Overview</h2>
        <div className="chips">{GROUPS.map(([k, l]) => <Link key={k} className="chip" href={`/applications?filter=${k}`}>{l} <b>{counts[k]}</b></Link>)}</div>
      </section>
    </>
  );
}

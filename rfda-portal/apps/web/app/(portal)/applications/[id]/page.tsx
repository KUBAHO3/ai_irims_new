'use client';
import { TYPES, allIssues, canEdit, fmtDate, type ApplicationDto } from '@rfda/shared';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppTab, Tabs, type TabKey } from '@/components/AppTabs';
import { Icon } from '@/components/Icon';
import { JourneyRail } from '@/components/journey';
import { HelpdeskModal } from '@/components/modals';
import { NextAction } from '@/components/NextAction';
import { NotFound } from '@/components/NotFound';
import { useModal } from '@/components/ui';
import { fetcher } from '@/lib/api';

const TABS: [TabKey, string][] = [['overview', 'Overview'], ['documents', 'Documents'], ['payment', 'Payment'], ['queries', 'Queries'], ['history', 'History']];

export default function ApplicationPage() {
  return <Suspense><ApplicationDetail /></Suspense>;
}

function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const openModal = useModal();
  const { data: app, error } = useSWR<ApplicationDto>(`/applications/${id}`, fetcher);
  const [tab, setTab] = useState<TabKey | null>((params.get('tab') as TabKey) || null);

  useEffect(() => { if (app?.isDraft) router.replace(`/applications/${app.id}/edit`); }, [app, router]);
  useEffect(() => { if (params.get('tab')) setTab(params.get('tab') as TabKey); }, [params]);
  if (error) return <NotFound back="/applications" />;
  if (!app || app.isDraft) return <p className="loading">Loading…</p>;
  const current = tab || (app.status === 'queried' ? 'queries' : 'overview');

  return (
    <>
      <div className="page-head"><div><div className="crumbs"><Link href="/applications">My applications</Link> / {app.ref}</div><h1>{app.brand}</h1>
        <p className="sub">{app.ref}. {app.generic}, {TYPES[app.type].short}, {app.category}. Submitted {fmtDate(app.submittedAt)}.</p></div>
        <span className="spacer" />
        {canEdit(app) && <Link className="btn small no-print" href={`/applications/${app.id}/edit`}>Change application</Link>}
        <button className="btn small no-print" onClick={() => openModal((close) => <HelpdeskModal close={close} refNo={app.ref} />)}><Icon name="help" />Ask about this application</button></div>
      {canEdit(app) && allIssues(app).length > 0 && (
        <div className="notice red" style={{ marginBottom: 20 }}><strong>{allIssues(app).length} item{allIssues(app).length > 1 ? 's are' : ' is'} missing since your last change</strong>
          <p className="small">Complete the application before you {app.status === 'queried' ? 'send your response' : 'pay'}. <Link href={`/applications/${app.id}/edit`}>Change application</Link></p></div>
      )}
      <section className="panel panel-pad"><JourneyRail app={app} action={<NextAction app={app} />} /></section>
      <section className="panel" style={{ marginTop: 20 }}>
        <Tabs tabs={TABS} tab={current} setTab={setTab} app={app} />
        <div className="panel-pad" role="tabpanel"><AppTab app={app} tab={current} role="applicant" /></div>
      </section>
    </>
  );
}

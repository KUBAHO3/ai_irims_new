'use client';
import type { ApplicationDto } from '@rfda/shared';
import Link from 'next/link';
import { CertModal, PayModal } from './modals';
import { useModal } from './ui';

/** The applicant's next-step button shown on the journey rail. */
export function NextAction({ app }: { app: ApplicationDto }) {
  const openModal = useModal();
  if (app.status === 'draft') return <Link className="btn primary" href={`/applications/${app.id}/edit`}>Continue application</Link>;
  if (app.status === 'awaiting_payment') return <button className="btn primary" onClick={() => openModal((close) => <PayModal app={app} close={close} />)}>Pay or upload proof</button>;
  if (app.status === 'queried') return <Link className="btn primary" href={`/applications/${app.id}?tab=queries`}>Answer query</Link>;
  if (app.status === 'approved') return <button className="btn" onClick={() => openModal(() => <CertModal app={app} />)}>View certificate</button>;
  return null;
}

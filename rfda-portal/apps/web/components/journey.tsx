'use client';
import { RAIL, STAGE_INDEX, STAGE_NAME, journey, type AppStatus, type Stage, type TrackDto } from '@rfda/shared';
import type { ReactNode } from 'react';

type RailApp = Pick<TrackDto, 'status' | 'stage' | 'stageAt' | 'queriedAt' | 'certNo' | 'expiresAt' | 'invoice' | 'queries'> & { step?: number };

/** The journey rail: seven stages, who holds the application, and what happens next. */
export function JourneyRail({ app, action }: { app: RailApp; action?: ReactNode }) {
  const idx = STAGE_INDEX[app.stage];
  const j = journey(app);
  const capLabel = app.status === 'approved' ? 'Registered' : app.status === 'rejected' ? 'Rejected' : RAIL[idx] + (app.status === 'queried' ? ' (query)' : '');
  return (
    <>
      <p className="rail-caption" aria-hidden="true">Stage {idx + 1} of 7: {capLabel}</p>
      <ol className="rail" aria-label="Application progress">
        {RAIL.map((name, i) => {
          let cls = '';
          let label = name;
          if (i < idx) cls = 'done';
          if (i === idx) cls = `now ${j.who}`;
          if (i === 6 && app.status === 'approved') label = 'Registered';
          if (i === 6 && app.status === 'rejected') label = 'Rejected';
          if (i === idx && app.status === 'queried') label = name + ' (query)';
          return <li key={name} className={cls} aria-current={i === idx ? 'step' : undefined}><span>{label}</span></li>;
        })}
      </ol>
      <div className={`next-step ${j.who}`}>
        <span className="who">{j.label}</span>
        <div><strong>{j.title}</strong><span className="small">{j.detail}</span></div>
        {action ?? <span />}
      </div>
    </>
  );
}

export function RailMini({ app }: { app: RailApp }) {
  const idx = STAGE_INDEX[app.stage];
  const j = journey(app);
  return (
    <span className="rail-mini" aria-hidden="true">
      {RAIL.map((name, i) => <i key={name} className={`${i < idx ? 'done' : i === idx ? 'now ' + j.who : ''}${i === 6 && app.status === 'approved' ? ' done' : ''}`} />)}
    </span>
  );
}

export function StatusBadge({ app }: { app: { status: AppStatus; stage: Stage } }) {
  if (app.status === 'draft') return <span className="badge draft">Draft</span>;
  if (app.status === 'awaiting_payment') return <span className="badge you">Payment due</span>;
  if (app.status === 'queried') return <span className="badge you">Query to answer</span>;
  if (app.status === 'approved') return <span className="badge ok">Registered</span>;
  if (app.status === 'rejected') return <span className="badge bad">Rejected</span>;
  return <span className="badge fda">{STAGE_NAME[app.stage]}</span>;
}

const INVOICE_BADGE = {
  unpaid: <span className="badge you">Not paid</span>,
  proof_uploaded: <span className="badge fda">Proof uploaded, awaiting confirmation</span>,
  verified: <span className="badge ok">Payment confirmed</span>,
  rejected: <span className="badge bad">Proof not accepted</span>,
};
export const InvoiceBadge = ({ status }: { status: keyof typeof INVOICE_BADGE }) => INVOICE_BADGE[status];

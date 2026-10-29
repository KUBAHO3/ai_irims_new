/* Rules shared by the API (which enforces them) and the web app (which explains them). */
import {
  ARTWORK_ID, COMMON_DOCS, COUNTRIES, DocCondition, DocRequirement, INTENDED_USERS, LTRS, REFERENCE_AUTHORITIES, SLA, STAGE_NAME, TYPE_DOCS, TYPES,
} from './reference';
import type { AppStatus, FileDto, ProductFields, ProductType, Stage, TrackDto } from './types';

export const DAY = 86400000;
const TZ = 'Africa/Kigali';

export const money = (n: number | null | undefined) => 'RWF ' + Number(n || 0).toLocaleString('en-US');
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '');
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '');
export const fileSize = (b: number) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
export const truncate = (s: string | null | undefined, n: number) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export const daysLeft = (fromIso: string, days: number, now = Date.now()) => Math.ceil((new Date(fromIso).getTime() + days * DAY - now) / DAY);
export const isMedicine = (type: ProductType) => type === 'HM' || type === 'VM';

type CondApp = Pick<ProductFields, 'trademarkDiffers' | 'srA'>;
const CONDITIONS: Record<DocCondition, (app: CondApp) => boolean> = {
  trademarkDiffers: (app) => !!app.trademarkDiffers,
  reliance: (app) => app.srA === 'Yes',
};

/** Every requirement for a product type, before conditions are applied. */
export function allDocsFor(type: ProductType): DocRequirement[] {
  return COMMON_DOCS.concat(TYPE_DOCS[type] || []);
}
/** Requirements that apply to this application. */
export function docsFor(app: CondApp & { type: ProductType }): DocRequirement[] {
  return allDocsFor(app.type).filter((d) => !d.when || CONDITIONS[d.when](app));
}
export function filesFor(app: { files: FileDto[] }, requirementId: string): FileDto[] {
  return app.files.filter((f) => f.requirementId === requirementId && !f.queryId);
}
export function groupDocs<T extends { group: string }>(docs: T[]): [string, T[]][] {
  const out = new Map<string, T[]>();
  docs.forEach((d) => { if (!out.has(d.group)) out.set(d.group, []); out.get(d.group)!.push(d); });
  return [...out.entries()];
}

/* ---------------------------------------------------------------- Wizard fields */
export interface FieldDef {
  k: keyof ProductFields;
  l: string;
  type?: 'select' | 'textarea' | 'number' | 'check';
  options?: string[];
  req?: boolean;
  span?: boolean;
  hint?: string;
  /** Only shown (and validated) when this returns true. */
  show?: (app: ProductFields) => boolean;
}

export function stepFields(app: { type: ProductType }): FieldDef[][] {
  const t = TYPES[app.type];
  const med = isMedicine(app.type);
  return [
    [
      { k: 'brand', l: 'Brand or product name', req: true },
      { k: 'generic', l: med ? 'Active ingredient (INN)' : 'Common name', req: true },
      { k: 'category', l: 'Category', type: 'select', options: t.categories, req: true },
      { k: 'form', l: med ? 'Dosage form' : 'Product form', type: 'select', options: t.forms, req: true },
      { k: 'size', l: t.sizeLabel, req: true, hint: app.type === 'HM' ? 'e.g. 500 mg' : 'e.g. 400 g or 250 mL' },
      { k: 'intendedUsers', l: 'Intended users', type: 'select', options: INTENDED_USERS, req: true },
      { k: 'intendedUse', l: 'Intended use', type: 'textarea', req: true, span: true },
      { k: 'storage', l: 'Storage conditions', req: true, span: true, hint: 'Include a temperature, e.g. “Store below 30°C”.' },
      { k: 'shelfLife', l: 'Shelf life (months)', type: 'number', req: true },
      { k: 'description', l: 'Physical description', hint: 'Form, colour, shape' },
      { k: 'warnings', l: 'Warnings on the label', span: true },
    ],
    [
      { k: 'mfrName', l: 'Manufacturer name', req: true },
      { k: 'mfrCountry', l: 'Country of manufacture', type: 'select', options: COUNTRIES, req: true },
      { k: 'mfrAddress', l: 'Manufacturing site address', req: true, span: true },
      { k: 'origin', l: 'Product origin', type: 'select', options: ['Locally manufactured', 'Imported'], req: true },
      {
        k: 'srA', l: 'Registered by a recognized regulatory authority?', type: 'select', options: ['No', 'Yes'], req: true,
        hint: app.type === 'HM' ? 'If yes, the reliance pathway applies: you’ll upload a declaration of sameness, the reference authority’s GMP certificate and a letter of authorization.' : undefined,
      },
      { k: 'refAuthority', l: 'Reference regulatory authority', type: 'select', options: REFERENCE_AUTHORITIES, req: true, show: (a) => a.srA === 'Yes' },
      { k: 'ltr', l: 'Local technical representative', type: 'select', options: LTRS, req: true, span: true, hint: 'Must hold a valid premises licence in Rwanda.' },
      { k: 'trademarkDiffers', l: 'The trademark holder is not the manufacturer', type: 'check', span: true },
    ],
  ];
}
export const visibleFields = (app: ProductFields & { type: ProductType }, step: number) =>
  (stepFields(app)[step] || []).filter((f) => !f.show || f.show(app));

/* ---------------------------------------------------------------- Validation */
export interface Issue { step: number; k?: string; msg: string }
type ValidatableApp = ProductFields & { type: ProductType; files: FileDto[] };

export function validateStep(app: ValidatableApp, step: number): Issue[] {
  const issues: Issue[] = [];
  if (step < 2) visibleFields(app, step).forEach((f) => { if (f.req && !String(app[f.k] ?? '').trim()) issues.push({ step, k: f.k, msg: `${f.l} is missing` }); });
  if (step === 2) docsFor(app).forEach((d) => { if (d.req && !filesFor(app, d.id).length) issues.push({ step, msg: `${d.name}: not uploaded` }); });
  if (step === 3) {
    if (!filesFor(app, ARTWORK_ID).length) issues.push({ step, msg: 'Label or artwork: not uploaded' });
    if (!String(app.labelText || '').trim()) issues.push({ step, msg: 'Label text: not entered' });
  }
  return issues;
}
export const allIssues = (app: ValidatableApp) => [0, 1, 2, 3].flatMap((s) => validateStep(app, s));

/* ---------------------------------------------------------------- Journey */
export type Who = 'you' | 'fda' | 'ok' | 'bad';
export interface Journey { who: Who; label: string; title: string; detail: string }
type JourneyApp = Pick<TrackDto, 'status' | 'stage' | 'stageAt' | 'queriedAt' | 'certNo' | 'expiresAt' | 'invoice' | 'queries'> & { step?: number };

export function lastOpenQuery<Q extends { from: string; answered: boolean }>(app: { queries: Q[] }): Q | undefined {
  return [...app.queries].reverse().find((q) => q.from === 'fda' && !q.answered);
}

export function journey(app: JourneyApp, now = Date.now()): Journey {
  const inv = app.invoice;
  if (app.status === 'draft') return { who: 'you', label: 'With you', title: 'Finish and submit your application', detail: `Step ${(app.step || 0) + 1} of 5. Your progress is saved.` };
  if (app.status === 'awaiting_payment') {
    const by = new Date(new Date(app.stageAt).getTime() + SLA.payment * DAY).toISOString();
    return { who: 'you', label: 'With you', title: `Pay invoice ${inv?.no} (${money(inv?.amount)})`, detail: `Then upload the proof of payment. Assessment starts once Rwanda FDA confirms it. Pay by ${fmtDate(by)}.` };
  }
  if (app.status === 'queried') {
    const q = lastOpenQuery(app);
    return { who: 'you', label: 'With you', title: 'Answer the query from Rwanda FDA', detail: `Raised ${fmtDate(q?.at)} at ${STAGE_NAME[app.stage].toLowerCase()}. Respond within ${Math.max(0, daysLeft(app.queriedAt || app.stageAt, SLA.queried, now))} days to keep your application active.` };
  }
  if (app.status === 'approved') return { who: 'ok', label: 'Registered', title: `Certificate ${app.certNo} issued`, detail: `Valid until ${fmtDate(app.expiresAt)}.` };
  if (app.status === 'rejected') return { who: 'bad', label: 'Rejected', title: 'Application rejected', detail: 'The reason is in the history tab. You can submit a new application after addressing it.' };
  const expect = new Date(new Date(app.stageAt).getTime() + (SLA[app.stage] || 0) * DAY).toISOString();
  const what: Partial<Record<Stage, string>> = { verification: 'Rwanda FDA is confirming your payment', screening: 'Rwanda FDA is checking that your dossier is complete', assessment: 'Assessors are evaluating your product', approval: 'Waiting for the final decision' };
  return { who: 'fda', label: 'With Rwanda FDA', title: what[app.stage] || 'With Rwanda FDA', detail: `Expected to finish this stage by ${fmtDate(expect)}. Nothing is needed from you now.` };
}

export interface Due { cls: '' | 'soon' | 'over'; text: string; d: number }
export function dueInfo(app: { stage: Stage; stageAt: string }, now = Date.now()): Due {
  const d = daysLeft(app.stageAt, SLA[app.stage] || 0, now);
  if (d < 0) return { cls: 'over', text: `Overdue ${-d} day${d === -1 ? '' : 's'}`, d };
  if (d <= 3) return { cls: 'soon', text: d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`, d };
  return { cls: '', text: `Due in ${d} days`, d };
}

export type Group = 'action' | 'fda' | 'approved' | 'rejected';
export function groupOf(status: AppStatus): Group {
  if (status === 'draft' || status === 'awaiting_payment' || status === 'queried') return 'action';
  if (status === 'in_review') return 'fda';
  return status;
}

/* ---------------------------------------------------------------- Editing after submission */
/** The applicant may change an application only while it is with them. */
export const EDITABLE_STATUSES: AppStatus[] = ['draft', 'awaiting_payment', 'queried'];
export const canEdit = (app: { status: AppStatus }) => EDITABLE_STATUSES.includes(app.status);

/** History actions recorded when an applicant changes a submitted application. */
export const EDIT_ACTIONS = ['Details changed', 'Documents changed'];

const EXTRA_LABELS: Partial<Record<keyof ProductFields, string>> = { labelText: 'Label text', labelLanguages: 'Label languages', submissionType: 'Submission type' };
export function fieldLabel(type: ProductType, k: keyof ProductFields): string {
  return stepFields({ type }).flat().find((f) => f.k === k)?.l || EXTRA_LABELS[k] || String(k);
}

/** Issues in the details and label text (not documents): what a saved edit must not leave behind. */
export function detailIssues(app: ValidatableApp): Issue[] {
  const issues = [...validateStep(app, 0), ...validateStep(app, 1)];
  if (!String(app.labelText || '').trim()) issues.push({ step: 3, k: 'labelText', msg: 'Label text is missing' });
  return issues;
}

/** Applicant changes made since Rwanda FDA last acted on the application. */
export function changesSinceFda<H extends { by: string; action: string }>(history: H[]): H[] {
  const out: H[] = [];
  for (let i = history.length - 1; i >= 0 && history[i].by !== 'fda'; i--) if (EDIT_ACTIONS.includes(history[i].action)) out.unshift(history[i]);
  return out;
}

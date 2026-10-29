import { Prisma, StoredFile } from '@prisma/client';
import type { ApplicationDto, FileDto, ProductType } from '@rfda/shared';

export const APP_INCLUDE = {
  files: { orderBy: { createdAt: 'asc' } },
  invoice: { include: { proof: true } },
  queries: { orderBy: { createdAt: 'asc' } },
  history: { orderBy: { at: 'asc' } },
  checks: true,
} satisfies Prisma.ApplicationInclude;

export type AppFull = Prisma.ApplicationGetPayload<{ include: typeof APP_INCLUDE }>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const toFileDto = (f: StoredFile): FileDto => ({ id: f.id, requirementId: f.requirementId, queryId: f.queryId, name: f.originalName, size: f.size, at: f.createdAt.toISOString() });

export function toDto(a: AppFull): ApplicationDto {
  return {
    id: a.id, ref: a.ref, isDraft: a.isDraft, type: a.type as ProductType, applicant: a.applicant, applicantAddress: a.applicantAddress,
    category: a.category, submissionType: a.submissionType, brand: a.brand, generic: a.generic, form: a.form, size: a.size,
    intendedUse: a.intendedUse, intendedUsers: a.intendedUsers, storage: a.storage, shelfLife: a.shelfLife, description: a.description, warnings: a.warnings,
    mfrName: a.mfrName, mfrCountry: a.mfrCountry, mfrAddress: a.mfrAddress, origin: a.origin, srA: a.srA, refAuthority: a.refAuthority, ltr: a.ltr,
    trademarkDiffers: a.trademarkDiffers, labelText: a.labelText, labelLanguages: a.labelLanguages,
    status: a.status, stage: a.stage, stageAt: a.stageAt.toISOString(), step: a.step,
    queriedAt: iso(a.queriedAt), submittedAt: iso(a.submittedAt), decidedAt: iso(a.decidedAt), certNo: a.certNo, expiresAt: iso(a.expiresAt),
    recommendation: a.recommendation === 'approve' || a.recommendation === 'reject' ? a.recommendation : null,
    urgent: a.urgent, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
    files: a.files.map(toFileDto),
    invoice: a.invoice && { no: a.invoice.no, amount: a.invoice.amount, status: a.invoice.status, issuedAt: a.invoice.issuedAt.toISOString(), proof: a.invoice.proof && toFileDto(a.invoice.proof), momoRef: a.invoice.momoRef },
    queries: a.queries.map((q) => ({ id: q.id, from: q.from, stage: q.stage, text: q.text, answered: q.answered, at: q.createdAt.toISOString(), files: a.files.filter((f) => f.queryId === q.id).map(toFileDto) })),
    history: a.history.map((h) => ({ at: h.at.toISOString(), by: h.by, action: h.action, note: h.note, stage: h.stage })),
    checks: a.checks.map((c) => c.requirementId),
  };
}

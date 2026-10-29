import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Stage } from '@prisma/client';
import { CERT_VALID_YEARS, DAY, docsFor, filesFor, truncate, type ApplicationDto, type DecisionAction } from '@rfda/shared';
import { addHistory } from '../applications/applications.service';
import { APP_INCLUDE, AppFull, toDto } from '../applications/mapper';
import type { SessionUser } from '../auth/decorators';
import { nextValue, pad4 } from '../core/counters';
import { PrismaService } from '../core/prisma.service';
import { DecisionDto } from './dto';

/** Which decisions are allowed at which stage. */
const ALLOWED: Record<DecisionAction, Stage[]> = {
  'pay-ok': ['verification'], 'pay-bad': ['verification'],
  accept: ['screening'], query: ['screening', 'assessment'],
  'rec-approve': ['assessment'], 'rec-reject': ['assessment'],
  approve: ['approval'], return: ['approval'], reject: ['approval'],
};
const NEEDS_COMMENT: DecisionAction[] = ['pay-bad', 'query', 'rec-reject', 'return', 'reject'];

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  /** Everything not in draft: the in-tray and enquiries both filter this on the client. */
  async list(q?: string): Promise<ApplicationDto[]> {
    const term = q?.trim();
    const where: Prisma.ApplicationWhereInput = { isDraft: false };
    if (term) where.OR = [{ ref: { contains: term, mode: 'insensitive' } }, { brand: { contains: term, mode: 'insensitive' } }, { applicant: { contains: term, mode: 'insensitive' } }];
    const apps = await this.prisma.application.findMany({ where, include: APP_INCLUDE, orderBy: { submittedAt: 'desc' } });
    return apps.map(toDto);
  }

  async get(id: string): Promise<ApplicationDto> { return toDto(await this.load(id)); }

  async setCheck(user: SessionUser, id: string, requirementId: string, checked: boolean): Promise<ApplicationDto> {
    const app = await this.load(id);
    if (app.status !== 'in_review' || app.stage !== 'screening') throw new BadRequestException('Documents can only be ticked during screening.');
    if (!docsFor(toDto(app)).some((d) => d.id === requirementId)) throw new BadRequestException('Unknown document requirement.');
    const key = { applicationId_requirementId: { applicationId: id, requirementId } };
    if (checked) await this.prisma.documentCheck.upsert({ where: key, create: { applicationId: id, requirementId, checkedById: user.id }, update: {} });
    else await this.prisma.documentCheck.deleteMany({ where: { applicationId: id, requirementId } });
    return this.get(id);
  }

  async decide(user: SessionUser, id: string, dto: DecisionDto): Promise<{ app: ApplicationDto; message: string }> {
    const app = await this.load(id);
    const { action } = dto;
    const comment = (dto.comment || '').trim();
    if (app.status !== 'in_review' || !ALLOWED[action].includes(app.stage)) throw new BadRequestException('This decision is not available at the current stage. Reload the application.');
    if (NEEDS_COMMENT.includes(action) && !comment) throw new BadRequestException('Add a comment explaining your decision.');

    const now = new Date();
    let message = '';
    await this.prisma.$transaction(async (tx) => {
      const move = async (stage: Stage, act: string, note: string, extra: Prisma.ApplicationUpdateInput = {}) => {
        await tx.application.update({ where: { id }, data: { stage, stageAt: now, ...extra } });
        await addHistory(tx, id, 'fda', user.id, act, note, app.stage);
      };
      switch (action) {
        case 'pay-ok':
          await tx.invoice.update({ where: { applicationId: id }, data: { status: 'verified' } });
          await move('screening', 'Payment confirmed', comment);
          message = `${app.ref}: payment confirmed, moved to screening.`;
          break;
        case 'pay-bad':
          await tx.invoice.update({ where: { applicationId: id }, data: { status: 'rejected' } });
          await move('payment', 'Payment not confirmed', comment, { status: 'awaiting_payment' });
          message = `${app.ref}: returned to the applicant for payment.`;
          break;
        case 'accept': {
          const dto = toDto(app);
          const docs = docsFor(dto);
          const missing = docs.filter((d) => d.req && !filesFor(dto, d.id).length);
          if (missing.length) throw new BadRequestException('Required documents are missing. Raise a query instead.');
          const unchecked = docs.filter((d) => filesFor(dto, d.id).length && !dto.checks.includes(d.id));
          if (unchecked.length) throw new BadRequestException(`Tick every document you’ve checked before accepting (${unchecked.length} not ticked).`);
          await move('assessment', 'Dossier accepted for assessment', comment || 'All mandatory documents present.');
          message = `${app.ref}: accepted for assessment.`;
          break;
        }
        case 'query':
          await tx.query.create({ data: { applicationId: id, from: 'fda', stage: app.stage, text: comment, authorId: user.id } });
          await tx.application.update({ where: { id }, data: { status: 'queried', queriedAt: now } });
          await addHistory(tx, id, 'fda', user.id, 'Query raised', truncate(comment, 140), app.stage);
          message = `${app.ref}: query sent to ${app.applicant}.`;
          break;
        case 'rec-approve':
          await move('approval', 'Recommended for approval', (dto.findings || '').trim() || comment, { recommendation: 'approve' });
          message = `${app.ref}: sent for final decision with an approval recommendation.`;
          break;
        case 'rec-reject':
          await move('approval', 'Recommended for rejection', [comment, (dto.findings || '').trim()].filter(Boolean).join('\n\n'), { recommendation: 'reject' });
          message = `${app.ref}: sent for final decision with a rejection recommendation.`;
          break;
        case 'approve': {
          const certNo = `RW-FDA-${app.type}-${now.getFullYear()}-${pad4(await nextValue(tx, 'cert', 100))}`;
          const expiresAt = new Date(now.getTime() + CERT_VALID_YEARS * 365 * DAY);
          await move('decision', 'Approved', `Certificate ${certNo} issued. ${comment}`.trim(), { status: 'approved', certNo, decidedAt: now, expiresAt });
          message = `${app.ref}: approved. Certificate ${certNo} issued.`;
          break;
        }
        case 'return':
          await move('assessment', 'Returned to assessment', comment, { recommendation: null });
          message = `${app.ref}: returned to assessment.`;
          break;
        case 'reject':
          await move('decision', 'Rejected', comment, { status: 'rejected', decidedAt: now });
          message = `${app.ref}: rejected. The applicant has been notified.`;
          break;
      }
    });
    return { app: await this.get(id), message };
  }

  private async load(id: string): Promise<AppFull> {
    const app = await this.prisma.application.findUnique({ where: { id }, include: APP_INCLUDE });
    if (!app || app.isDraft) throw new NotFoundException('Application not found');
    return app;
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ARTWORK_ID, EDITABLE_FIELDS, PAYMENT_PROOF_ID, QUERY_FILE_ID, TYPES, allDocsFor, allIssues, canEdit, detailIssues, fieldLabel, lastOpenQuery,
  type ApplicationDto, type ProductFields,
} from '@rfda/shared';
import { randomInt } from 'crypto';
import type { SessionUser } from '../auth/decorators';
import { nextValue, pad4 } from '../core/counters';
import { PrismaService } from '../core/prisma.service';
import { StorageService } from '../core/storage.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto';
import { APP_INCLUDE, AppFull, toDto } from './mapper';

type Tx = Prisma.TransactionClient;

export function addHistory(tx: Tx, applicationId: string, by: 'applicant' | 'fda', actorId: string, action: string, note: string, stage: AppFull['stage']) {
  return tx.historyEvent.create({ data: { applicationId, by, actorId, action, note, stage } });
}

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async list(user: SessionUser): Promise<ApplicationDto[]> {
    const apps = await this.prisma.application.findMany({ where: { ownerId: user.id }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' } });
    return apps.map(toDto);
  }

  async get(user: SessionUser, id: string): Promise<ApplicationDto> {
    return toDto(await this.load(user, id));
  }

  async create(user: SessionUser, dto: CreateApplicationDto): Promise<ApplicationDto> {
    if (!TYPES[dto.type].categories.includes(dto.category)) throw new BadRequestException('Choose a category for this product type.');
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const app = await this.prisma.$transaction(async (tx) => {
      const n = await nextValue(tx, 'draft', 5000);
      const created = await tx.application.create({
        data: { ref: `DRAFT-${n}`, ownerId: owner.id, applicant: owner.name, applicantAddress: owner.address || '', type: dto.type, category: dto.category, submissionType: dto.submissionType },
      });
      await addHistory(tx, created.id, 'applicant', user.id, 'Application started', '', 'draft');
      return tx.application.findUniqueOrThrow({ where: { id: created.id }, include: APP_INCLUDE });
    });
    return toDto(app);
  }

  async update(user: SessionUser, id: string, dto: UpdateApplicationDto): Promise<ApplicationDto> {
    const current = await this.loadEditable(user, id);
    const data: Prisma.ApplicationUpdateInput = {};
    const changed: (keyof ProductFields)[] = [];
    for (const k of EDITABLE_FIELDS) {
      if (dto[k] === undefined || JSON.stringify(dto[k]) === JSON.stringify(current[k])) continue;
      (data as Record<string, unknown>)[k] = dto[k];
      changed.push(k);
    }
    if (dto.step !== undefined) data.step = dto.step;
    if (current.isDraft || !changed.length) return toDto(await this.prisma.application.update({ where: { id }, data, include: APP_INCLUDE }));

    // Submitted: the details were complete when submitted, so a saved change must keep them complete.
    const issues = detailIssues({ ...toDto(current), ...(data as Partial<ProductFields>) });
    if (issues.length) throw new BadRequestException({ message: issues.map((i) => i.msg).join('. ') + '.', issues });
    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({ where: { id }, data });
      await addHistory(tx, id, 'applicant', user.id, 'Details changed', 'Changed: ' + changed.map((k) => fieldLabel(current.type, k)).join(', '), current.stage);
    });
    return this.get(user, id);
  }

  async remove(user: SessionUser, id: string) {
    const app = await this.loadDraft(user, id);
    await this.prisma.application.delete({ where: { id } });
    this.storage.remove(app.files.map((f) => f.storedName));
  }

  /** Upload one or more files against a dossier requirement or the label artwork. */
  async upload(user: SessionUser, id: string, requirementId: string, files: Express.Multer.File[]): Promise<ApplicationDto> {
    try {
      if (!files?.length) throw new BadRequestException('Choose a file to upload.');
      const app = await this.loadEditable(user, id);
      const req = allDocsFor(app.type).find((d) => d.id === requirementId);
      if (!req && requirementId !== ARTWORK_ID) throw new BadRequestException('Unknown document requirement.');
      const multiple = !!req?.multiple;
      if (!multiple && files.length > 1) throw new BadRequestException('Upload a single file for this document.');
      const replaced = multiple ? [] : app.files.filter((f) => f.requirementId === requirementId && !f.queryId);
      await this.prisma.$transaction(async (tx) => {
        if (replaced.length) await tx.storedFile.deleteMany({ where: { id: { in: replaced.map((f) => f.id) } } });
        await tx.storedFile.createMany({ data: files.map((f) => this.fileRow(app.id, requirementId, user.id, f)) });
        await tx.application.update({ where: { id }, data: { updatedAt: new Date() } });
        if (!app.isDraft) {
          const what = `${req?.name || 'Label or artwork'}: ${files.map((f) => f.originalname).join(', ')} ${replaced.length ? 'replaced the previous file' : 'added'}`;
          await this.documentChanged(tx, app, user.id, requirementId, what);
        }
      });
      this.storage.remove(replaced.map((f) => f.storedName));
      return this.get(user, id);
    } catch (e) {
      this.storage.remove((files || []).map((f) => f.filename));
      throw e;
    }
  }

  async removeFile(user: SessionUser, id: string, fileId: string): Promise<ApplicationDto> {
    const app = await this.loadEditable(user, id);
    const file = app.files.find((f) => f.id === fileId && !f.queryId && f.requirementId !== PAYMENT_PROOF_ID);
    if (!file) throw new NotFoundException('File not found');
    if (!app.isDraft) {
      const req = allDocsFor(app.type).find((d) => d.id === file.requirementId);
      const required = file.requirementId === ARTWORK_ID || !!req?.req;
      const others = app.files.filter((f) => f.requirementId === file.requirementId && !f.queryId && f.id !== fileId);
      if (required && !others.length) throw new BadRequestException('This document is required. Upload a replacement instead of removing the last file.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.storedFile.delete({ where: { id: fileId } });
      if (!app.isDraft) {
        const name = allDocsFor(app.type).find((d) => d.id === file.requirementId)?.name || 'Label or artwork';
        await this.documentChanged(tx, app, user.id, file.requirementId, `${name}: ${file.originalName} removed`);
      }
    });
    this.storage.remove([file.storedName]);
    return this.get(user, id);
  }

  async submit(user: SessionUser, id: string): Promise<ApplicationDto> {
    const app = await this.loadDraft(user, id);
    const issues = allIssues(toDto(app));
    if (issues.length) throw new BadRequestException({ message: `${issues.length} item(s) to complete before you can submit`, issues });
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(2);
      const ref = `RFDA${yy}/${app.type}/${pad4(await nextValue(tx, `ref-${yy}-${app.type}`))}`;
      const invNo = `101${now.getFullYear()}-${pad4(await nextValue(tx, `invoice-${now.getFullYear()}`))}`;
      await tx.application.update({
        where: { id },
        data: { ref, isDraft: false, step: 0, status: 'awaiting_payment', stage: 'payment', stageAt: now, submittedAt: now, invoice: { create: { no: invNo, amount: TYPES[app.type].fee } } },
      });
      await addHistory(tx, id, 'applicant', user.id, 'Application submitted', `Invoice ${invNo} issued`, 'draft');
    });
    return this.get(user, id);
  }

  async payMobileMoney(user: SessionUser, id: string): Promise<ApplicationDto> {
    const app = await this.loadAwaitingPayment(user, id);
    this.assertComplete(app);
    // Placeholder until the mobile money gateway is connected: records a reference only.
    const momoRef = 'MM' + String(randomInt(1e8)).padStart(8, '0');
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { applicationId: id }, data: { status: 'proof_uploaded', momoRef, proofId: null } });
      await this.toVerification(tx, app.id);
      await addHistory(tx, id, 'applicant', user.id, 'Paid with mobile money', `Transaction ${momoRef}`, 'payment');
    });
    return this.get(user, id);
  }

  async uploadPaymentProof(user: SessionUser, id: string, file: Express.Multer.File): Promise<ApplicationDto> {
    try {
      if (!file) throw new BadRequestException('Choose the proof of payment file.');
      const app = await this.loadAwaitingPayment(user, id);
      this.assertComplete(app);
      await this.prisma.$transaction(async (tx) => {
        const proof = await tx.storedFile.create({ data: this.fileRow(app.id, PAYMENT_PROOF_ID, user.id, file) });
        await tx.invoice.update({ where: { applicationId: id }, data: { status: 'proof_uploaded', proofId: proof.id, momoRef: null } });
        await this.toVerification(tx, app.id);
        await addHistory(tx, id, 'applicant', user.id, 'Proof of payment uploaded', file.originalname, 'payment');
      });
      return this.get(user, id);
    } catch (e) {
      if (file) this.storage.remove([file.filename]);
      throw e;
    }
  }

  async replyToQuery(user: SessionUser, id: string, text: string, files: Express.Multer.File[] = []): Promise<ApplicationDto> {
    try {
      const app = await this.load(user, id);
      const open = lastOpenQuery(app);
      if (app.status !== 'queried' || !open) throw new BadRequestException('There is no open query on this application.');
      this.assertComplete(app);
      await this.prisma.$transaction(async (tx) => {
        await tx.query.update({ where: { id: open.id }, data: { answered: true } });
        const reply = await tx.query.create({ data: { applicationId: id, from: 'applicant', stage: app.stage, text: text.trim(), answered: true, authorId: user.id } });
        if (files.length) await tx.storedFile.createMany({ data: files.map((f) => ({ ...this.fileRow(id, QUERY_FILE_ID, user.id, f), queryId: reply.id })) });
        await tx.application.update({ where: { id }, data: { status: 'in_review', stageAt: new Date(), queriedAt: null } });
        await addHistory(tx, id, 'applicant', user.id, 'Query answered', files.length ? `${files.length} file(s) attached` : '', app.stage);
      });
      return this.get(user, id);
    } catch (e) {
      this.storage.remove(files.map((f) => f.filename));
      throw e;
    }
  }

  /* ---------------------------------------------------------------- helpers */

  private async load(user: SessionUser, id: string): Promise<AppFull> {
    const app = await this.prisma.application.findUnique({ where: { id }, include: APP_INCLUDE });
    if (!app || app.ownerId !== user.id) throw new NotFoundException('Application not found');
    return app;
  }

  private async loadDraft(user: SessionUser, id: string) {
    const app = await this.load(user, id);
    if (!app.isDraft) throw new ForbiddenException('This application has been submitted and can no longer be edited.');
    return app;
  }

  /** Drafts, and submitted applications while they are with the applicant (awaiting payment or queried). */
  private async loadEditable(user: SessionUser, id: string) {
    const app = await this.load(user, id);
    if (!canEdit(app)) throw new ForbiddenException('This application is with Rwanda FDA and can’t be changed now. You can change it while it is awaiting payment or when Rwanda FDA sends you a query.');
    return app;
  }

  /** Changes to a submitted application can leave it incomplete; it must be complete before it goes back to Rwanda FDA. */
  private assertComplete(app: AppFull) {
    const issues = allIssues(toDto(app));
    if (issues.length) throw new BadRequestException({ message: `Complete your application first: ${issues.map((i) => i.msg).join('; ')}.`, issues });
  }

  /** Logs a document change on a submitted application and clears its screening tick so it is checked again. */
  private async documentChanged(tx: Tx, app: AppFull, userId: string, requirementId: string, note: string) {
    await tx.documentCheck.deleteMany({ where: { applicationId: app.id, requirementId } });
    await addHistory(tx, app.id, 'applicant', userId, 'Documents changed', note, app.stage);
  }

  private async loadAwaitingPayment(user: SessionUser, id: string) {
    const app = await this.load(user, id);
    if (app.status !== 'awaiting_payment' || !app.invoice || !['unpaid', 'rejected'].includes(app.invoice.status)) throw new BadRequestException('This invoice is not awaiting payment.');
    return app;
  }

  private toVerification(tx: Tx, id: string) {
    return tx.application.update({ where: { id }, data: { status: 'in_review', stage: 'verification', stageAt: new Date() } });
  }

  private fileRow(applicationId: string, requirementId: string, uploadedById: string, f: Express.Multer.File) {
    return { applicationId, requirementId, uploadedById, originalName: f.originalname, storedName: f.filename, mimeType: this.storage.mimeFor(f.originalname), size: f.size };
  }
}

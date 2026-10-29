import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysis, Prisma, User } from '@prisma/client';
import { ARTWORK_ID, allDocsFor, canEdit, type AiAnalysisDto, type AiResult } from '@rfda/shared';
import { timingSafeEqual } from 'crypto';
import { openAsBlob } from 'fs';
import type { SessionUser } from '../auth/decorators';
import { PrismaService } from '../core/prisma.service';
import { StorageService } from '../core/storage.service';

/** Form fields sent to the AI service as the virtual "application-form" document. */
const FORM_FIELDS = [
  'applicant', 'applicantAddress', 'category', 'submissionType', 'brand', 'generic', 'form', 'size', 'intendedUse', 'intendedUsers', 'storage',
  'shelfLife', 'description', 'warnings', 'mfrName', 'mfrCountry', 'mfrAddress', 'origin', 'srA', 'refAuthority', 'ltr', 'trademarkDiffers',
] as const;
/** A running analysis is checked with the service directly once it is this old, in case the callback was missed. */
const POLL_AFTER_MS = 20_000;

type WithUser = AiAnalysis & { requestedBy: Pick<User, 'name'> };
/** "assessor": internal review; "applicant": the applicant's own pre-check. Each sees only their own. */
export type Audience = 'assessor' | 'applicant';

@Injectable()
export class AiService {
  private readonly log = new Logger(AiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly callbackKey: string;
  private readonly callbackUrl: string;
  private readonly maxBytes: number;
  private readonly applicantDailyLimit: number;

  constructor(private prisma: PrismaService, private storage: StorageService, config: ConfigService) {
    this.baseUrl = (config.get<string>('AI_N8N_URL') || '').replace(/\/+$/, '');
    this.apiKey = config.get<string>('AI_API_KEY') || '';
    this.callbackKey = config.get<string>('AI_CALLBACK_KEY') || '';
    this.callbackUrl = config.get<string>('AI_CALLBACK_URL') || '';
    this.maxBytes = Number(config.get('AI_MAX_UPLOAD_MB') || 60) * 1024 * 1024;
    this.applicantDailyLimit = Number(config.get('AI_APPLICANT_DAILY_LIMIT') || 5);
  }

  get enabled() { return !!(this.baseUrl && this.apiKey); }

  async list(user: SessionUser, applicationId: string, audience: Audience): Promise<AiAnalysisDto[]> {
    await this.loadApp(user, applicationId, audience);
    const rows = await this.prisma.aiAnalysis.findMany({ where: { applicationId, audience }, include: { requestedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 });
    // Recover results whose callback never arrived (portal down, network) by asking the service.
    const refreshed = await Promise.all(rows.map((r) => (r.status === 'running' && r.externalId && Date.now() - r.createdAt.getTime() > POLL_AFTER_MS ? this.poll(r) : r)));
    return refreshed.map(toDto);
  }

  /** Sends the application's documents to the n8n service. The result arrives later by callback. */
  async request(user: SessionUser, applicationId: string, audience: Audience): Promise<AiAnalysisDto> {
    if (!this.enabled) throw new ServiceUnavailableException('The AI review service is not configured (AI_N8N_URL, AI_API_KEY).');
    const app = await this.loadApp(user, applicationId, audience);
    if (audience === 'applicant' && !canEdit(app)) throw new BadRequestException('The AI pre-check is available while you can still change the application.');
    const busy = await this.prisma.aiAnalysis.findFirst({ where: { applicationId, audience, status: { in: ['requesting', 'running'] }, createdAt: { gt: new Date(Date.now() - 2 * 3600_000) } } });
    if (busy) throw new ConflictException('An AI check of this application is already running.');
    if (audience === 'applicant') {
      // Each check costs LLM credit, so applicants get a few per application per day.
      const today = await this.prisma.aiAnalysis.count({ where: { applicationId, audience, createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } } });
      if (today >= this.applicantDailyLimit) throw new HttpException(`You can run the AI pre-check ${this.applicantDailyLimit} times a day per application. Try again tomorrow.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Dossier documents and the label artwork, each named after its requirement (m3, m3__2, rra-gmp …).
    const known = new Set([...allDocsFor(app.type).map((d) => d.id), ARTWORK_ID]);
    const form = new FormData();
    const count: Record<string, number> = {};
    const notSent: { requirementId: string; fileName: string; size: number }[] = [];
    let bytes = 0;
    for (const f of app.files) {
      if (f.queryId || !known.has(f.requirementId)) continue;
      if (bytes + f.size > this.maxBytes) { notSent.push({ requirementId: f.requirementId, fileName: f.originalName, size: f.size }); continue; }
      count[f.requirementId] = (count[f.requirementId] || 0) + 1;
      const field = count[f.requirementId] === 1 ? f.requirementId : `${f.requirementId}__${count[f.requirementId]}`;
      form.append(field, await openAsBlob(this.storage.path(f.storedName), { type: f.mimeType }), f.originalName);
      bytes += f.size;
    }
    form.append('applicationRef', app.ref);
    form.append('productType', app.type);
    form.append('fields', JSON.stringify(Object.fromEntries(FORM_FIELDS.map((k) => [k, app[k]]).filter(([, v]) => v !== '' && v !== null))));
    if (app.labelText.trim()) form.append('labelText', app.labelText);
    if (this.callbackUrl) form.append('callbackUrl', this.callbackUrl);

    // Recorded before the call, so a very fast callback always finds its row.
    const row = await this.prisma.aiAnalysis.create({ data: { applicationId, audience, status: 'requesting', stage: app.stage, requestedById: user.id, notSent } });
    try {
      const res = await fetch(`${this.baseUrl}/ai/analyses`, { method: 'POST', headers: { 'X-API-Key': this.apiKey }, body: form, signal: AbortSignal.timeout(120_000) });
      const body = (await res.json().catch(() => ({}))) as { analysisId?: string; message?: string; errors?: string[] };
      if (res.status !== 202 || !body.analysisId) throw new Error(body.errors?.join('; ') || body.message || `HTTP ${res.status}`);
      const saved = await this.prisma.aiAnalysis.update({ where: { id: row.id }, data: { status: 'running', externalId: body.analysisId }, include: { requestedBy: { select: { name: true } } } });
      return toDto(saved);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.log.warn(`AI request for ${app.ref} failed: ${reason}`);
      await this.prisma.aiAnalysis.update({ where: { id: row.id }, data: { status: 'failed', error: `Could not reach the AI service: ${reason}`, finishedAt: new Date() } });
      throw new ServiceUnavailableException('The AI review service did not accept the request. Try again later.');
    }
  }

  /** Called by n8n when an analysis finishes or fails. */
  async callback(key: string | undefined, body: unknown) {
    if (!this.callbackKey || !key || !safeEqual(key, this.callbackKey)) throw new UnauthorizedException();
    const b = (body || {}) as { analysisId?: unknown; status?: unknown; error?: unknown };
    if (typeof b.analysisId !== 'string' || (b.status !== 'completed' && b.status !== 'failed')) throw new BadRequestException('analysisId and status are required');
    const row = await this.prisma.aiAnalysis.findUnique({ where: { externalId: b.analysisId } });
    if (!row) throw new NotFoundException('Unknown analysisId');
    await this.save(row, body as Record<string, unknown>);
    return { received: true };
  }

  /** Assessors see every submitted application; applicants only their own. */
  private async loadApp(user: SessionUser, applicationId: string, audience: Audience) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { files: { orderBy: { createdAt: 'asc' } } } });
    const visible = app && (audience === 'applicant' ? app.ownerId === user.id : !app.isDraft);
    if (!app || !visible) throw new NotFoundException('Application not found');
    return app;
  }

  private async poll(row: WithUser): Promise<WithUser> {
    try {
      const res = await fetch(`${this.baseUrl}/ai/analyses?id=${encodeURIComponent(row.externalId!)}`, { headers: { 'X-API-Key': this.apiKey }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return row;
      const body = (await res.json()) as Record<string, unknown>;
      if (body.status !== 'completed' && body.status !== 'failed') return row;
      return this.save(row, body);
    } catch {
      return row; // service unreachable: keep showing "running"
    }
  }

  private save(row: AiAnalysis, body: Record<string, unknown>): Promise<WithUser> {
    const data: Prisma.AiAnalysisUpdateInput = body.status === 'completed'
      ? { status: 'completed', result: body as Prisma.InputJsonValue, verdict: (body as unknown as AiResult).overall?.verdict ?? null, summary: String(body.summary ?? ''), error: null }
      : { status: 'failed', error: String(body.error ?? 'The analysis failed'), result: Prisma.DbNull };
    return this.prisma.aiAnalysis.update({ where: { id: row.id }, data: { ...data, finishedAt: new Date() }, include: { requestedBy: { select: { name: true } } } });
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function toDto(r: WithUser): AiAnalysisDto {
  return {
    id: r.id, status: r.status as AiAnalysisDto['status'], stage: r.stage, verdict: r.verdict as AiAnalysisDto['verdict'], summary: r.summary, error: r.error,
    requestedBy: r.requestedBy.name, createdAt: r.createdAt.toISOString(), finishedAt: r.finishedAt?.toISOString() ?? null,
    notSent: (r.notSent as AiAnalysisDto['notSent']) || [], result: (r.result as unknown as AiResult) ?? null,
  };
}

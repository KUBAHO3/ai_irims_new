import { Body, Controller, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HELPDESK_TOPICS, type TrackDto } from '@rfda/shared';
import { CurrentUser, Public, SessionUser } from '../auth/decorators';
import { nextValue } from '../core/counters';
import { PrismaService } from '../core/prisma.service';

class HelpdeskDto {
  @IsIn(HELPDESK_TOPICS) topic: string;
  @IsOptional() @IsString() @MaxLength(40) ref?: string;
  @IsString() @IsNotEmpty({ message: 'Describe the issue.' }) @MaxLength(5000) message: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
}

@Controller()
export class PublicController {
  constructor(private prisma: PrismaService) {}

  /** Public tracking by tracking number: progress only, no documents or personal data. */
  @Public() @Get('public/track')
  async track(@Query('ref') ref = ''): Promise<TrackDto> {
    const app = await this.prisma.application.findFirst({
      where: { ref: { equals: ref.trim(), mode: 'insensitive' }, isDraft: false },
      include: { invoice: true, queries: { select: { from: true, answered: true, createdAt: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!app) throw new NotFoundException('No application found with that tracking number.');
    return {
      ref: app.ref, brand: app.brand, type: app.type, status: app.status, stage: app.stage, stageAt: app.stageAt.toISOString(),
      queriedAt: app.queriedAt?.toISOString() ?? null, certNo: app.certNo, expiresAt: app.expiresAt?.toISOString() ?? null,
      invoice: app.invoice && { no: app.invoice.no, amount: app.invoice.amount },
      queries: app.queries.map((q) => ({ from: q.from, answered: q.answered, at: q.createdAt.toISOString() })),
    };
  }

  @Public() @Post('helpdesk')
  async helpdesk(@Body() dto: HelpdeskDto, @CurrentUser() user?: SessionUser) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const no = `HD-${await nextValue(tx, 'helpdesk', 1000)}`;
      return tx.helpdeskTicket.create({ data: { no, topic: dto.topic, ref: dto.ref?.trim() || null, message: dto.message.trim(), email: dto.email, userId: user?.id } });
    });
    return { no: ticket.no };
  }
}

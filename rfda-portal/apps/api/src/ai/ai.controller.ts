import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles, SessionUser } from '../auth/decorators';
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(private ai: AiService) {}

  /* Assessors: internal AI review of a submitted application. */
  @Roles('assessor') @Get('review/applications/:id/ai-analyses')
  list(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.ai.list(user, id, 'assessor'); }

  @Roles('assessor') @Post('review/applications/:id/ai-analyses')
  request(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.ai.request(user, id, 'assessor'); }

  /* Applicants: AI pre-check of their own application while they can still change it. */
  @Roles('applicant') @Get('applications/:id/ai-checks')
  listChecks(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.ai.list(user, id, 'applicant'); }

  @Roles('applicant') @Post('applications/:id/ai-checks')
  requestCheck(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.ai.request(user, id, 'applicant'); }

  /** n8n posts results here, authenticated with the shared X-Callback-Key, not a user session. */
  @Public() @Post('ai/callback') @HttpCode(200)
  callback(@Headers('x-callback-key') key: string | undefined, @Body() body: unknown) { return this.ai.callback(key, body); }
}

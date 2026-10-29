import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles, SessionUser } from '../auth/decorators';
import { CheckDto, DecisionDto } from './dto';
import { ReviewService } from './review.service';

@Controller('review')
@Roles('assessor')
export class ReviewController {
  constructor(private review: ReviewService) {}

  @Get('applications')
  list(@Query('q') q?: string) { return this.review.list(q); }

  @Get('applications/:id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.review.get(id); }

  @Put('applications/:id/checks/:requirementId')
  setCheck(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('requirementId') requirementId: string, @Body() dto: CheckDto) {
    return this.review.setCheck(user, id, requirementId, dto.checked);
  }

  @Post('applications/:id/decision') @HttpCode(200)
  decide(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.review.decide(user, id, dto);
  }
}

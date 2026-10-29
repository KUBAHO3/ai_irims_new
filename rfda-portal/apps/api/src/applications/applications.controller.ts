import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Roles, SessionUser } from '../auth/decorators';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto, QueryReplyDto, SubmitDto, UpdateApplicationDto } from './dto';

/** The applicant's own applications. */
@Controller('applications')
@Roles('applicant')
export class ApplicationsController {
  constructor(private apps: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) { return this.apps.list(user); }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateApplicationDto) { return this.apps.create(user, dto); }

  @Get(':id')
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.apps.get(user, id); }

  @Patch(':id')
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationDto) { return this.apps.update(user, id, dto); }

  @Delete(':id') @HttpCode(204)
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.apps.remove(user, id); }

  @Post(':id/files/:requirementId')
  @UseInterceptors(FilesInterceptor('files', 30))
  upload(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('requirementId') requirementId: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.apps.upload(user, id, requirementId, files);
  }

  @Delete(':id/files/:fileId')
  removeFile(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.apps.removeFile(user, id, fileId);
  }

  @Post(':id/submit') @HttpCode(200)
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() _dto: SubmitDto) { return this.apps.submit(user, id); }

  @Post(':id/payment/mobile-money') @HttpCode(200)
  payMobileMoney(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.apps.payMobileMoney(user, id); }

  @Post(':id/payment/proof') @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  uploadProof(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.apps.uploadPaymentProof(user, id, file);
  }

  @Post(':id/queries/reply') @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files', 30))
  reply(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QueryReplyDto, @UploadedFiles() files: Express.Multer.File[]) {
    return this.apps.replyToQuery(user, id, dto.text, files);
  }
}

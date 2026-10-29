import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { CurrentUser, SessionUser } from '../auth/decorators';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Controller('files')
export class FilesController {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  @Get(':id')
  async download(@Param('id', ParseUUIDPipe) id: string, @Query('inline') inline: string, @CurrentUser() user: SessionUser, @Res({ passthrough: true }) res: Response) {
    const file = await this.prisma.storedFile.findUnique({ where: { id }, include: { application: { select: { ownerId: true } } } });
    if (!file || (user.role !== 'assessor' && file.application.ownerId !== user.id)) throw new NotFoundException('File not found');
    const path = this.storage.path(file.storedName);
    if (!existsSync(path)) throw new NotFoundException('The file is no longer available on the server');
    const disposition = inline === '1' ? 'inline' : 'attachment';
    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(path));
  }
}

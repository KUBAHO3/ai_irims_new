import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALLOWED_UPLOAD_EXT } from '@rfda/shared';
import { randomUUID } from 'crypto';
import { mkdirSync, unlink } from 'fs';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.zip': 'application/zip',
};

/** Files live on local disk under UPLOAD_DIR with random names; metadata is in StoredFile. */
@Injectable()
export class StorageService {
  readonly dir: string;
  readonly maxBytes: number;

  constructor(config: ConfigService) {
    this.dir = resolve(config.get('UPLOAD_DIR') || './uploads');
    this.maxBytes = Number(config.get('MAX_UPLOAD_MB') || 200) * 1024 * 1024;
    mkdirSync(this.dir, { recursive: true });
  }

  multerOptions(): MulterOptions {
    return {
      storage: diskStorage({
        destination: this.dir,
        filename: (_req, file, cb) => cb(null, randomUUID() + extname(file.originalname).toLowerCase()),
      }),
      limits: { fileSize: this.maxBytes, files: 30 },
      fileFilter: (_req, file, cb) => {
        // Multer decodes header filenames as latin1; restore UTF-8 names (e.g. accents).
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = extname(file.originalname).toLowerCase();
        if (ALLOWED_UPLOAD_EXT.includes(ext)) cb(null, true);
        else cb(new BadRequestException(`${file.originalname}: file type not accepted. Use ${ALLOWED_UPLOAD_EXT.join(', ')}.`), false);
      },
    };
  }

  path(storedName: string) { return resolve(this.dir, storedName); }

  /** Content type from the (allow-listed) extension, never from what the browser claimed. */
  mimeFor(name: string) { return MIME[extname(name).toLowerCase()] || 'application/octet-stream'; }

  remove(storedNames: string[]) {
    storedNames.forEach((n) => unlink(this.path(n), () => undefined));
  }
}

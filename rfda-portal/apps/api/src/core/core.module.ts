import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { PrismaService } from './prisma.service';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [
    StorageModule,
    MulterModule.registerAsync({ imports: [StorageModule], inject: [StorageService], useFactory: (storage: StorageService) => storage.multerOptions() }),
  ],
  controllers: [FilesController],
  providers: [PrismaService],
  exports: [PrismaService, StorageModule, MulterModule],
})
export class CoreModule {}

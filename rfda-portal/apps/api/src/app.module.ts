import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { PublicModule } from './public/public.module';
import { ReviewModule } from './review/review.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CoreModule, AuthModule, ApplicationsModule, ReviewModule, PublicModule],
})
export class AppModule {}

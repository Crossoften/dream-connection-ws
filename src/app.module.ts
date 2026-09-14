import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { LoginModule } from './modules/login/login.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './modules/mail/mail.module';
import { NoAuthModule } from './modules/no-auth/no-auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { WebModule } from './modules/web/web.module';
import { AiModule } from './modules/ai/ai.module';
import { DreamerModule } from './modules/dreamer/dreamer.module';
import { DreamsModule } from './modules/dreams/dreams.module';
import { DictionaryModule } from './modules/dictionary/dictionary.module';
import { JourneyModule } from './modules/journey/journey.module';
import { NpsModule } from './modules/nps/nps.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    LoginModule,
    MailModule,
    NoAuthModule,
    AdminModule,
    MobileModule,
    WebModule,
    AiModule,
    DreamerModule,
    DreamsModule,
    DictionaryModule,
    JourneyModule,
    NpsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

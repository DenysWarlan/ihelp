import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { envValidationSchema } from '../common/config/env.validation.js';
import { createLoggerConfig } from '../common/logging/logger.config.js';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware.js';
import { CorrelationIdService } from '../common/middleware/correlation-id.service.js';
import { CorrelationIdModule } from '../common/middleware/correlation-id.module.js';
import {
  GLOBAL_THROTTLE_TTL,
  GLOBAL_THROTTLE_LIMIT,
} from '../common/security/throttler.const.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { PrismaModule } from '@org/prisma-client';
import { HealthModule } from '../health/health.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { InviteModule } from '../auth/invite/invite.module.js';
import { ConsentModule } from '../auth/consent/consent.module.js';
import { MfaModule } from '../auth/mfa/mfa.module.js';
import { BreakGlassModule } from '../auth/break-glass/break-glass.module.js';
import { AuditModule } from '../common/audit/audit.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { LmsModule } from '../lms/lms.module.js';
import { UsersModule } from '../users/users.module.js';
import { EventsModule } from '../events/events.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    // Correlation ID must be first so it's available to other modules
    CorrelationIdModule,

    // Global rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: GLOBAL_THROTTLE_TTL * 1000,
        limit: GLOBAL_THROTTLE_LIMIT,
      },
    ]),

    // Configuration with env validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      envFilePath: ['.env'],
    }),

    // Structured logging with Pino
    LoggerModule.forRootAsync({
      inject: [CorrelationIdService],
      useFactory: (correlationIdService: CorrelationIdService) =>
        createLoggerConfig(correlationIdService),
    }),

    // BullMQ queues backed by Redis
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port) || 6379,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'notifications' },
      { name: 'sla-timers' },
    ),

    // Database
    PrismaModule,

    // Global modules
    AuditModule,

    // Feature modules
    HealthModule,
    AuthModule,
    InviteModule,
    ConsentModule,
    MfaModule,
    BreakGlassModule,
    CasesModule,
    ChatModule,
    LmsModule,
    UsersModule,
    EventsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

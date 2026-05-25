import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from 'nestjs-pino';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import helmet from 'helmet';

import { AppModule } from './app/app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { CorrelationIdService } from './common/middleware/correlation-id.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging via Pino
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:4333'],
    credentials: true,
  });

  // Global prefix (exclude health for load balancer probes)
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, { exclude: ['health'] });

  // Global validation pipe (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter
  const correlationIdService = app.get(CorrelationIdService);
  app.useGlobalFilters(new AllExceptionsFilter(correlationIdService));

  // Socket.io with Redis adapter for horizontal scaling
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  try {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    const redisIoAdapter = new IoAdapter(app);
    const originalCreate = IoAdapter.prototype.createIOServer;
    (redisIoAdapter as unknown as Record<string, unknown>)['createIOServer'] = function (
      port: number,
      options?: Record<string, unknown>,
    ) {
      const server = originalCreate.call(this, port, options);
      server.adapter(createAdapter(pubClient, subClient));
      return server;
    };
    app.useWebSocketAdapter(redisIoAdapter);
    logger.log('Socket.io Redis adapter configured');
  } catch (err) {
    logger.warn(
      `Failed to connect Redis adapter for Socket.io, falling back to in-memory: ${(err as Error).message}`,
    );
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();

import { Global, Module } from '@nestjs/common';
import { CorrelationIdService } from './correlation-id.service.js';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';

@Global()
@Module({
  providers: [CorrelationIdService, CorrelationIdMiddleware],
  exports: [CorrelationIdService, CorrelationIdMiddleware],
})
export class CorrelationIdModule {}

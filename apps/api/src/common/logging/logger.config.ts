import { Params } from 'nestjs-pino';
import { CorrelationIdService } from '../middleware/correlation-id.service.js';

export function createLoggerConfig(
  correlationIdService: CorrelationIdService,
): Params {
  return {
    pinoHttp: {
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      autoLogging: true,
      customProps: () => ({
        correlationId: correlationIdService.getCorrelationId() ?? 'N/A',
      }),
      serializers: {
        req: (req: Record<string, unknown>) => ({
          method: req['method'],
          url: req['url'],
          correlationId: (req['headers'] as Record<string, unknown>)?.['x-correlation-id'],
        }),
        res: (res: Record<string, unknown>) => ({
          statusCode: res['statusCode'],
        }),
      },
    },
  };
}

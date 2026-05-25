import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class CorrelationIdService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<string>();

  run(correlationId: string, callback: () => void): void {
    this.asyncLocalStorage.run(correlationId, callback);
  }

  getCorrelationId(): string | undefined {
    return this.asyncLocalStorage.getStore();
  }
}

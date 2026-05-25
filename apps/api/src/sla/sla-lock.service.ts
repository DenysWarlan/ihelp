import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

import {
  SLA_LOCK_BASE_DELAY_MS,
  SLA_LOCK_MAX_RETRIES,
  SLA_LOCK_PREFIX,
  SLA_LOCK_TTL_SECONDS,
} from './sla.const.js';
import { SlaLockResult } from './sla.model.js';

/**
 * Distributed lock using Redis SET NX EX for SLA mutations (S-E07-06).
 *
 * Each lock is keyed by `sla:lock:<caseId>` and protected by a unique
 * value so only the holder can release it (compare-and-delete via Lua).
 */
@Injectable()
export class SlaLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaLockService.name);
  private redis!: Redis;

  /** Lua script: release lock only if value matches (compare-and-delete). */
  private static readonly RELEASE_LUA = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });

    this.redis.on('error', (err: Error) => {
      this.logger.error(`SLA lock Redis error: ${err.message}`);
    });

    this.logger.log('SlaLockService Redis client initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // ---------------------------------------------------------------------------
  // Acquire
  // ---------------------------------------------------------------------------

  /**
   * Attempt to acquire a distributed lock for a case.
   * Retries with exponential backoff on failure.
   */
  async acquire(caseId: string): Promise<SlaLockResult> {
    const key = `${SLA_LOCK_PREFIX}${caseId}`;
    const lockValue = randomUUID();

    for (let attempt = 0; attempt < SLA_LOCK_MAX_RETRIES; attempt++) {
      const result = await this.redis.set(
        key,
        lockValue,
        'EX',
        SLA_LOCK_TTL_SECONDS,
        'NX',
      );

      if (result === 'OK') {
        this.logger.debug(`Lock acquired for case ${caseId} (attempt ${attempt + 1})`);
        return { acquired: true, lockValue };
      }

      // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms
      const delay = SLA_LOCK_BASE_DELAY_MS * Math.pow(2, attempt);
      await this.sleep(delay);
    }

    this.logger.warn(
      `Failed to acquire lock for case ${caseId} after ${SLA_LOCK_MAX_RETRIES} retries`,
    );
    return { acquired: false, lockValue: '' };
  }

  // ---------------------------------------------------------------------------
  // Release
  // ---------------------------------------------------------------------------

  /**
   * Release the lock only if we still own it (compare-and-delete).
   */
  async release(caseId: string, lockValue: string): Promise<boolean> {
    const key = `${SLA_LOCK_PREFIX}${caseId}`;

    const result = await this.redis.eval(
      SlaLockService.RELEASE_LUA,
      1,
      key,
      lockValue,
    );

    const released = result === 1;
    if (!released) {
      this.logger.warn(
        `Lock release failed for case ${caseId} — lock expired or owned by another holder`,
      );
    }

    return released;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

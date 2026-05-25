import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import * as crypto from 'node:crypto';

import { AuditService } from '../common/audit/audit.service.js';
import {
  AUDIT_ACTIONS,
  ENCRYPTED_VALUE_MASK,
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_AUTH_TAG_LENGTH,
  ENCRYPTION_IV_LENGTH,
  ENCRYPTION_KEY_LENGTH,
  INTEGRATION_CATEGORY,
  MVP_NOTIFICATION_PREFIX,
  SETTINGS_CATEGORIES,
  SettingsCategory,
} from './admin.const.js';
import {
  IntegrationEntry,
  IntegrationTestResult,
  SettingEntry,
  SettingsResponse,
} from './admin.model.js';

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);

  /** In-memory cache for settings by category. */
  private readonly settingsCache = new Map<string, SettingEntry[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // S-E13-07: Automation Settings — Get by category
  // ---------------------------------------------------------------------------

  async getSettingsByCategory(
    category: SettingsCategory,
  ): Promise<SettingsResponse> {
    // Check cache first
    const cached = this.settingsCache.get(category);
    if (cached) {
      return { category, settings: cached };
    }

    const configs = await this.prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    const settings: SettingEntry[] = configs.map((c) => ({
      id: c.id,
      key: c.key,
      value: c.value,
      description: c.description,
      updatedAt: c.updatedAt,
    }));

    // Populate cache
    this.settingsCache.set(category, settings);

    return { category, settings };
  }

  // ---------------------------------------------------------------------------
  // S-E13-07: Automation Settings — Update category
  // ---------------------------------------------------------------------------

  async updateSettings(
    category: SettingsCategory,
    settings: Record<string, string>,
    actorId: string,
  ): Promise<SettingsResponse> {
    if (!SETTINGS_CATEGORIES.includes(category)) {
      throw new BadRequestException(
        `Invalid category: ${category}. Allowed: ${SETTINGS_CATEGORIES.join(', ')}`,
      );
    }

    const oldSettings = await this.prisma.systemConfig.findMany({
      where: { category },
    });
    const oldMap = new Map(oldSettings.map((s) => [s.key, s.value]));

    for (const [key, value] of Object.entries(settings)) {
      await this.prisma.systemConfig.upsert({
        where: { category_key: { category, key } },
        create: {
          category,
          key,
          value,
          isEncrypted: false,
        },
        update: { value },
      });
    }

    // Invalidate cache
    this.settingsCache.delete(category);

    // Audit log with old/new values
    await this.auditService.log(
      AUDIT_ACTIONS.SETTINGS_UPDATED,
      actorId,
      JSON.stringify({
        category,
        changes: Object.entries(settings).map(([key, value]) => ({
          key,
          oldValue: oldMap.get(key) ?? null,
          newValue: value,
        })),
      }),
    );

    this.logger.log(
      `Settings updated for category "${category}" by ${actorId}: ${Object.keys(settings).join(', ')}`,
    );

    return this.getSettingsByCategory(category);
  }

  // ---------------------------------------------------------------------------
  // S-E13-08: Integration Settings — List (masked)
  // ---------------------------------------------------------------------------

  async listIntegrations(): Promise<IntegrationEntry[]> {
    const configs = await this.prisma.systemConfig.findMany({
      where: { category: INTEGRATION_CATEGORY },
      orderBy: { key: 'asc' },
    });

    return configs.map((c) => ({
      id: c.id,
      key: c.key,
      value: c.isEncrypted ? ENCRYPTED_VALUE_MASK : c.value,
      description: c.description,
      isEncrypted: c.isEncrypted,
      updatedAt: c.updatedAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // S-E13-08: Integration Settings — Update (encrypt if needed)
  // ---------------------------------------------------------------------------

  async updateIntegration(
    key: string,
    value: string,
    description: string | undefined,
    actorId: string,
  ): Promise<IntegrationEntry> {
    const isEncrypted = this.shouldEncrypt(key);
    const storedValue = isEncrypted ? this.encrypt(value) : value;

    const config = await this.prisma.systemConfig.upsert({
      where: {
        category_key: { category: INTEGRATION_CATEGORY, key },
      },
      create: {
        category: INTEGRATION_CATEGORY,
        key,
        value: storedValue,
        isEncrypted,
        description: description ?? null,
      },
      update: {
        value: storedValue,
        isEncrypted,
        ...(description !== undefined && { description }),
      },
    });

    await this.auditService.log(
      AUDIT_ACTIONS.INTEGRATION_UPDATED,
      actorId,
      JSON.stringify({
        key,
        isEncrypted,
        description: description ?? null,
      }),
    );

    this.logger.log(`Integration setting "${key}" updated by ${actorId}`);

    return {
      id: config.id,
      key: config.key,
      value: isEncrypted ? ENCRYPTED_VALUE_MASK : config.value,
      description: config.description,
      isEncrypted: config.isEncrypted,
      updatedAt: config.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // S-E13-08: Integration Settings — Test connection
  // ---------------------------------------------------------------------------

  async testIntegration(
    key: string,
    actorId: string,
  ): Promise<IntegrationTestResult> {
    const config = await this.prisma.systemConfig.findFirst({
      where: { category: INTEGRATION_CATEGORY, key },
    });

    if (!config) {
      throw new NotFoundException(
        `Integration setting "${key}" not found`,
      );
    }

    const rawValue = config.isEncrypted
      ? this.decrypt(config.value)
      : config.value;

    let success = false;
    let message = '';

    // MVP: Log-based test results
    if (key.toLowerCase().includes('telegram')) {
      // Simulate Telegram getMe test
      if (rawValue && rawValue.length > 10) {
        success = true;
        message = 'Telegram bot token validated (MVP: log-based). getMe would be called with this token.';
      } else {
        message = 'Telegram bot token appears invalid (too short).';
      }
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} Telegram integration test: ${success ? 'SUCCESS' : 'FAILED'} — ${message}`,
      );
    } else if (key.toLowerCase().includes('zoom')) {
      // Simulate Zoom API key validation
      if (rawValue && rawValue.length > 5) {
        success = true;
        message = 'Zoom API key validated (MVP: log-based). Key format appears correct.';
      } else {
        message = 'Zoom API key appears invalid (too short).';
      }
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} Zoom integration test: ${success ? 'SUCCESS' : 'FAILED'} — ${message}`,
      );
    } else {
      message = `Integration test for "${key}" completed (MVP: no real connection test available).`;
      success = true;
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} Integration test for "${key}": ${message}`,
      );
    }

    await this.auditService.log(
      AUDIT_ACTIONS.INTEGRATION_TESTED,
      actorId,
      JSON.stringify({ key, success, message }),
    );

    return { key, success, message };
  }

  // ---------------------------------------------------------------------------
  // Encryption helpers (AES-256-GCM)
  // ---------------------------------------------------------------------------

  private getEncryptionKey(): Buffer {
    const envKey = process.env['SYSTEM_CONFIG_ENCRYPTION_KEY'];
    if (envKey && Buffer.from(envKey, 'hex').length === ENCRYPTION_KEY_LENGTH) {
      return Buffer.from(envKey, 'hex');
    }
    // MVP fallback: derive from a stable seed (NOT production-safe)
    return crypto
      .createHash('sha256')
      .update('ihelp-mvp-encryption-key-change-in-production')
      .digest();
  }

  private encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Store as: iv:authTag:ciphertext (all hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedStr: string): string {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid encrypted value format');
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Determine if a key should be encrypted based on naming convention.
   * Keys containing "token", "secret", "api_key", "password" are encrypted.
   */
  private shouldEncrypt(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('password')
    );
  }
}

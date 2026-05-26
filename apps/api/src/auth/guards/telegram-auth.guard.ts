import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { Request } from 'express';

import { OAuthProfile } from '../auth.model.js';

/**
 * Maximum age (in seconds) for a Telegram Login Widget callback.
 * Rejects data older than 5 minutes to prevent replay attacks.
 */
const MAX_AUTH_AGE_SECONDS = 300;

/**
 * Validates Telegram Login Widget data using HMAC-SHA-256.
 *
 * Telegram sends: id, first_name, last_name, username, photo_url, auth_date, hash
 * Verification: https://core.telegram.org/widgets/login#checking-authorization
 *
 * 1. Sort all fields (except hash) alphabetically as "key=value\n"
 * 2. Compute SHA-256 of bot token -> secret key
 * 3. HMAC-SHA-256(secret_key, data_check_string) must equal the hash
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const query = request.query as Record<string, string>;

    this.logger.log(`Telegram auth callback received, query keys: ${Object.keys(query).join(', ')}`);

    const hash = query['hash'];
    if (!hash || !query['id'] || !query['auth_date']) {
      this.logger.warn(`Missing Telegram auth fields. id=${query['id']}, auth_date=${query['auth_date']}, hash=${!!hash}`);
      throw new UnauthorizedException('Missing Telegram auth data');
    }

    if (!this.botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not set');
      throw new UnauthorizedException('Telegram bot token not configured');
    }

    // Check auth_date freshness
    const authDate = parseInt(query['auth_date'], 10);
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    this.logger.log(`Telegram auth_date age: ${age}s (max ${MAX_AUTH_AGE_SECONDS}s)`);
    if (age > MAX_AUTH_AGE_SECONDS) {
      this.logger.warn(`Telegram auth data too old: ${age}s`);
      throw new UnauthorizedException('Telegram auth data expired');
    }

    // Build the data-check-string: sorted key=value pairs joined by \n
    const dataCheckString = Object.keys(query)
      .filter((key) => key !== 'hash')
      .sort()
      .map((key) => `${key}=${query[key]}`)
      .join('\n');

    // Telegram Login Widget: secret_key = SHA256(bot_token)
    const secretKey = createHash('sha256')
      .update(this.botToken)
      .digest();

    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      this.logger.warn(`Telegram auth hash mismatch. Expected: ${computedHash}, got: ${hash}`);
      throw new UnauthorizedException('Invalid Telegram auth data');
    }

    this.logger.log(`Telegram hash valid for user id=${query['id']}`);

    // Build OAuthProfile and attach to request
    const name = [query['first_name'], query['last_name']]
      .filter(Boolean)
      .join(' ') || query['username'] || '';

    const profile: OAuthProfile = {
      provider: 'telegram',
      providerId: query['id'],
      email: `${query['username'] || query['id']}@telegram.user`,
      name,
      avatarUrl: query['photo_url'],
    };

    this.logger.log(`Telegram auth success: ${profile.name} (${profile.providerId}), email: ${profile.email}`);
    (request as Request & { user: OAuthProfile }).user = profile;
    return true;
  }
}

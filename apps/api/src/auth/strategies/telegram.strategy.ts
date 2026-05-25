import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as TgStrategy } from 'passport-telegram';

import { OAuthProfile } from '../auth.model.js';

@Injectable()
export class TelegramStrategy extends PassportStrategy(TgStrategy, 'telegram') {
  constructor(config: ConfigService) {
    super({
      botToken: config.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
    });
  }

  validate(
    profile: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    },
    done: (err: Error | null, user?: OAuthProfile) => void,
  ): void {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || '';

    const oauthProfile: OAuthProfile = {
      provider: 'telegram',
      providerId: String(profile.id),
      email: `${profile.username || profile.id}@telegram.user`,
      name,
      avatarUrl: profile.photo_url,
    };

    done(null, oauthProfile);
  }
}

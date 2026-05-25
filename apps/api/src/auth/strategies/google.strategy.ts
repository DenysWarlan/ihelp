import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

import { GOOGLE_STRATEGY } from '../auth.const.js';
import { OAuthProfile } from '../auth.model.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, GOOGLE_STRATEGY) {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails?: Array<{ value: string }>;
      displayName?: string;
      photos?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ): void {
    const oauthProfile: OAuthProfile = {
      provider: 'google',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName ?? '',
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, oauthProfile);
  }
}

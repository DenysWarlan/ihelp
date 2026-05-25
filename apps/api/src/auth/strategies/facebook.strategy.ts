import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';

import { OAuthProfile } from '../auth.model.js';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('FACEBOOK_APP_ID'),
      clientSecret: config.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      callbackURL: config.getOrThrow<string>('FACEBOOK_CALLBACK_URL'),
      scope: ['email'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: OAuthProfile) => void,
  ): void {
    const oauthProfile: OAuthProfile = {
      provider: 'facebook',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName ?? '',
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, oauthProfile);
  }
}

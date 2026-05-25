import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@org/prisma-client';

import { JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY } from './auth.const.js';
import { OAuthProfile, TokenPair, JwtPayload } from './auth.model.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async handleOAuthLogin(profile: OAuthProfile): Promise<TokenPair> {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });
      this.logger.log(`New user created via ${profile.provider}: ${user.id}`);
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: JWT_ACCESS_EXPIRY });
    const refreshToken = this.jwt.sign(payload, { expiresIn: JWT_REFRESH_EXPIRY });

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async getUserFromToken(payload: JwtPayload) {
    return this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
  }
}

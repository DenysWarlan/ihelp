import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@org/prisma-client';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';

import {
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  REFRESH_TOKEN_DAYS,
  CRISIS_SESSION_HOURS,
  TELEGRAM_EMAIL_DOMAIN,
} from './auth.const.js';
import {
  OAuthProfile,
  TokenPair,
  JwtPayload,
  ProviderLinkResponse,
} from './auth.model.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // Story 1 (S-E01-02): Implicit Registration + Unique Account
  // Story 2 (S-E01-03): Auto-link on login with matching email
  // Story 3 (S-E01-04): Token family tracking
  // ---------------------------------------------------------------------------

  async handleOAuthLogin(profile: OAuthProfile): Promise<TokenPair> {
    // For Telegram users without email, generate a synthetic one
    const email = profile.email || `${profile.providerId}@${TELEGRAM_EMAIL_DOMAIN}`;

    // Atomic upsert: handles race conditions when two requests arrive simultaneously
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        avatarUrl: profile.avatarUrl ?? undefined,
      },
      create: {
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });

    this.logger.log(`User ${user.id} authenticated via ${profile.provider}`);

    // Upsert ProviderLink: auto-link provider on login
    await this.prisma.providerLink.upsert({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerId,
      },
    });

    return this.createTokenPair(user.id, user.email, user.role);
  }

  // ---------------------------------------------------------------------------
  // Story 2 (S-E01-03): Provider Linking
  // ---------------------------------------------------------------------------

  async linkProvider(
    userId: string,
    profile: OAuthProfile,
  ): Promise<ProviderLinkResponse> {
    const link = await this.prisma.providerLink.upsert({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerId,
        },
      },
      update: {},
      create: {
        userId,
        provider: profile.provider,
        providerAccountId: profile.providerId,
      },
    });

    this.logger.log(`Provider ${profile.provider} linked to user ${userId}`);
    return {
      id: link.id,
      provider: link.provider,
      providerAccountId: link.providerAccountId,
      createdAt: link.createdAt,
    };
  }

  async unlinkProvider(userId: string, linkId: string): Promise<void> {
    const links = await this.prisma.providerLink.findMany({
      where: { userId },
    });

    if (links.length <= 1) {
      throw new ConflictException(
        'Cannot unlink the last provider. At least one provider must remain.',
      );
    }

    const link = links.find((l) => l.id === linkId);
    if (!link) {
      throw new ConflictException('Provider link not found');
    }

    await this.prisma.providerLink.delete({ where: { id: linkId } });
    this.logger.log(`Provider link ${linkId} removed from user ${userId}`);
  }

  async getProviders(userId: string): Promise<ProviderLinkResponse[]> {
    const links = await this.prisma.providerLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return links.map((link) => ({
      id: link.id,
      provider: link.provider,
      providerAccountId: link.providerAccountId,
      createdAt: link.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Story 3 (S-E01-04): JWT Token Rotation
  // ---------------------------------------------------------------------------

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const session = await this.prisma.session.findFirst({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Replay attack detection: if session is already revoked, revoke entire family
    if (session.isRevoked) {
      if (session.tokenFamily) {
        await this.revokeTokenFamily(session.tokenFamily);
      }
      this.logger.warn(
        `Replay attack detected for user ${session.userId}, token family ${session.tokenFamily}`,
      );
      throw new UnauthorizedException('Token reuse detected. All sessions revoked.');
    }

    // Crisis session: skip forced logout for 24 hours
    if (session.isCrisis) {
      const crisisCutoff = new Date();
      crisisCutoff.setHours(crisisCutoff.getHours() - CRISIS_SESSION_HOURS);
      if (session.createdAt > crisisCutoff) {
        // Return same tokens during crisis window without rotation
        const payload: JwtPayload = {
          sub: session.user.id,
          email: session.user.email,
          role: session.user.role,
        };
        return {
          accessToken: this.jwt.sign(payload, { expiresIn: JWT_ACCESS_EXPIRY }),
          refreshToken: session.token,
        };
      }
    }

    // Revoke current session
    await this.prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // Create new session with same token family
    return this.createTokenPair(
      session.user.id,
      session.user.email,
      session.user.role,
      session.tokenFamily ?? undefined,
    );
  }

  async revokeTokenFamily(tokenFamily: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenFamily },
      data: { isRevoked: true },
    });
    this.logger.log(`All sessions revoked for token family ${tokenFamily}`);
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { token: refreshToken },
    });

    if (!session) {
      return; // Idempotent — already logged out or invalid token
    }

    if (session.tokenFamily) {
      await this.revokeTokenFamily(session.tokenFamily);
    } else {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Staff Email/Password Login
  // ---------------------------------------------------------------------------

  async staffLogin(
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<TokenPair | { mfaRequired: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Only staff roles can use password login
    const staffRoles = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'];
    if (!staffRoles.includes(user.role)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check MFA
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return { mfaRequired: true };
      }
      const isValidMfa = authenticator.verify({
        token: mfaCode,
        secret: user.mfaSecret!,
      });
      if (!isValidMfa) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    this.logger.log(`Staff user ${user.id} authenticated via password`);
    return this.createTokenPair(user.id, user.email, user.role);
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  async getUserFromToken(payload: JwtPayload) {
    return this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
  }

  private async createTokenPair(
    userId: string,
    email: string,
    role: string,
    tokenFamily?: string,
  ): Promise<TokenPair> {
    const family = tokenFamily ?? uuidv4();

    const payload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload, { expiresIn: JWT_ACCESS_EXPIRY });
    const refreshToken = this.jwt.sign(payload, { expiresIn: JWT_REFRESH_EXPIRY });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await this.prisma.session.create({
      data: {
        userId,
        token: refreshToken,
        tokenFamily: family,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}

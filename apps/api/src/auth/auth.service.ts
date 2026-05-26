import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
  BCRYPT_SALT_ROUNDS,
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

    // Check if this provider is already linked to a user
    const existingLink = await this.prisma.providerLink.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerId,
        },
      },
      include: { user: true },
    });

    let user: { id: string; email: string; role: string; name: string | null };

    if (existingLink) {
      // Already linked — use the existing user
      user = existingLink.user;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: profile.avatarUrl ?? undefined },
      });
    } else if (profile.provider === 'telegram') {
      // Telegram first login — try to match by contactValue in CareCase
      const username = email.replace(/@telegram\.user$/, '');
      const matchedCase = await this.findCaseByTelegramUsername(username);

      if (matchedCase) {
        // Found existing user who left their Telegram username in a care case
        user = matchedCase.person;
        this.logger.log(
          `Telegram user @${username} matched to existing user ${user.id} via CareCase ${matchedCase.id}`,
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: profile.avatarUrl ?? undefined },
        });
      } else {
        // No match — create new user
        user = await this.prisma.user.upsert({
          where: { email },
          update: { avatarUrl: profile.avatarUrl ?? undefined },
          create: { email, name: profile.name, avatarUrl: profile.avatarUrl },
        });
      }

      // Create provider link
      await this.prisma.providerLink.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerId,
        },
      });
    } else {
      // Non-Telegram OAuth (Google, Facebook)
      user = await this.prisma.user.upsert({
        where: { email },
        update: { avatarUrl: profile.avatarUrl ?? undefined },
        create: { email, name: profile.name, avatarUrl: profile.avatarUrl },
      });

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
    }

    this.logger.log(`User ${user.id} authenticated via ${profile.provider}`);
    return this.createTokenPair(user.id, user.email, user.role, undefined, user.name ?? undefined);
  }

  /**
   * Find a CareCase where the person left their Telegram username as contact.
   * Matches contactMethod='telegram' and contactValue containing the username.
   */
  private async findCaseByTelegramUsername(username: string) {
    if (!username || username === 'undefined') return null;

    // Normalize: strip leading @ if present
    const normalized = username.replace(/^@/, '').toLowerCase();
    if (!normalized) return null;

    // Search for cases where contactValue matches the Telegram username
    const careCase = await this.prisma.careCase.findFirst({
      where: {
        contactMethod: { equals: 'telegram', mode: 'insensitive' },
        contactValue: {
          contains: normalized,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        person: { select: { id: true, email: true, role: true, name: true } },
      },
    });

    return careCase;
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
          name: session.user.name ?? undefined,
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
      session.user.name ?? undefined,
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
    return this.createTokenPair(user.id, user.email, user.role, undefined, user.name ?? undefined);
  }

  // ---------------------------------------------------------------------------
  // Person Email/Password Login
  // ---------------------------------------------------------------------------

  async personLogin(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== 'PERSON') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`Person user ${user.id} authenticated via password`);
    return this.createTokenPair(user.id, user.email, user.role, undefined, user.name ?? undefined);
  }

  // ---------------------------------------------------------------------------
  // Set Password
  // ---------------------------------------------------------------------------

  async setPassword(
    userId: string,
    newPassword: string,
    currentPassword?: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        throw new BadRequestException(
          'Current password is required to change an existing password',
        );
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    this.logger.log(`User ${userId} password updated`);
    return { message: 'Password updated successfully' };
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
    name?: string,
  ): Promise<TokenPair> {
    const family = tokenFamily ?? uuidv4();

    const payload: JwtPayload = { sub: userId, email, role, name };

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

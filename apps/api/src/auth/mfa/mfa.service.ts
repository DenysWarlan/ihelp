import * as crypto from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

import {
  BACKUP_CODES_COUNT,
  BACKUP_CODE_BYTES,
  MFA_ISSUER,
} from './mfa.const.js';
import { MfaSetupResponse } from './mfa.model.js';

/** Bcrypt rounds for backup code hashing (lower than password — these are one-time use). */
const BACKUP_HASH_ROUNDS = 10;

/** Max failed MFA attempts before lockout. */
const MFA_MAX_ATTEMPTS = 5;

/** Lockout duration in milliseconds (15 minutes). */
const MFA_LOCKOUT_MS = 15 * 60 * 1000;

interface MfaAttemptRecord {
  count: number;
  firstAttemptAt: number;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly attempts = new Map<string, MfaAttemptRecord>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a TOTP secret and QR code for the user.
   * The secret is stored but MFA is NOT yet enabled until `enableMfa` is called.
   */
  async setupMfa(userId: string): Promise<MfaSetupResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const secret = authenticator.generateSecret();

    // Store the secret (not yet enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    const otpauthUrl = authenticator.keyuri(user.email, MFA_ISSUER, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    this.logger.log(`MFA setup initiated for user ${userId}`);

    return { secret, qrCodeUrl };
  }

  /**
   * Verify a TOTP token and enable MFA for the user.
   * Generates and returns backup codes (plain text — shown once only).
   */
  async enableMfa(userId: string, token: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException(
        'MFA setup has not been initiated. Call POST /auth/mfa/setup first.',
      );
    }

    const isValid = authenticator.verify({
      token,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    // Generate backup codes
    const backupCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      const code = crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex');
      backupCodes.push(code);
      hashedCodes.push(await bcrypt.hash(code, BACKUP_HASH_ROUNDS));
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaBackupHash: hashedCodes,
      },
    });

    this.logger.log(`MFA enabled for user ${userId}`);

    return backupCodes;
  }

  /**
   * Verify a TOTP token during login.
   * Tracks failed attempts per user and locks out after MFA_MAX_ATTEMPTS.
   */
  async verifyMfa(userId: string, token: string): Promise<boolean> {
    this.checkLockout(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this user');
    }

    const isValid = authenticator.verify({ token, secret: user.mfaSecret });

    if (isValid) {
      this.attempts.delete(userId);
      return true;
    }

    this.recordFailedAttempt(userId);
    return false;
  }

  private checkLockout(userId: string): void {
    const record = this.attempts.get(userId);
    if (!record) return;

    const elapsed = Date.now() - record.firstAttemptAt;

    if (elapsed > MFA_LOCKOUT_MS) {
      this.attempts.delete(userId);
      return;
    }

    if (record.count >= MFA_MAX_ATTEMPTS) {
      const remainingMs = MFA_LOCKOUT_MS - elapsed;
      const remainingMin = Math.ceil(remainingMs / 60_000);
      this.logger.warn(`MFA locked out for user ${userId} — ${remainingMin} min remaining`);
      throw new ForbiddenException(
        `Too many failed MFA attempts. Try again in ${remainingMin} minutes.`,
      );
    }
  }

  private recordFailedAttempt(userId: string): void {
    const record = this.attempts.get(userId);

    if (record) {
      record.count++;
    } else {
      this.attempts.set(userId, { count: 1, firstAttemptAt: Date.now() });
    }

    const current = this.attempts.get(userId);
    if (current && current.count >= MFA_MAX_ATTEMPTS) {
      this.logger.warn(
        `User ${userId} locked out after ${MFA_MAX_ATTEMPTS} failed MFA attempts`,
      );
    }
  }

  /**
   * Verify a backup code. If valid, removes it so it cannot be reused.
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupHash: true, mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled for this user');
    }

    // Check each hashed backup code
    for (let i = 0; i < user.mfaBackupHash.length; i++) {
      const matches = await bcrypt.compare(code, user.mfaBackupHash[i]);
      if (matches) {
        // Remove the used code
        const updatedCodes = [...user.mfaBackupHash];
        updatedCodes.splice(i, 1);

        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaBackupHash: updatedCodes },
        });

        this.logger.warn(
          `Backup code used for user ${userId}. ${updatedCodes.length} codes remaining.`,
        );
        return true;
      }
    }

    return false;
  }
}

import * as crypto from 'node:crypto';

import {
  BadRequestException,
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

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

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
   */
  async verifyMfa(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this user');
    }

    return authenticator.verify({ token, secret: user.mfaSecret });
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

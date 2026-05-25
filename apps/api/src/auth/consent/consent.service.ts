import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { User } from '@prisma/client';

import { ConsentStatus } from './consent.model.js';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grant GDPR consent of the specified type.
   * 'data' = general data processing consent (Art. 6).
   * 'sensitive' = special category data consent (Art. 9).
   */
  async grantConsent(
    userId: string,
    type: 'data' | 'sensitive',
  ): Promise<User> {
    const field =
      type === 'data' ? 'dataConsentAt' : 'sensitiveDataConsentAt';

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: new Date() },
    });

    this.logger.log(`Consent granted: ${type} for user ${userId}`);
    return user;
  }

  /**
   * Revoke Art. 9 (sensitive data) consent.
   * Blocked if the user has an active crisis session to prevent
   * interruption of safeguarding obligations.
   */
  async revokeConsent(userId: string, type: 'sensitive'): Promise<void> {
    // Check for active crisis sessions — safeguarding override
    const activeCrisis = await this.prisma.session.findFirst({
      where: {
        userId,
        isCrisis: true,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeCrisis) {
      throw new ConflictException(
        'Cannot revoke sensitive data consent while an active crisis case exists',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { sensitiveDataConsentAt: null },
    });

    this.logger.log(
      `Sensitive data consent revoked for user ${userId}`,
    );
  }

  /**
   * Check whether the user has granted the minimum required consent
   * (general data processing) to use the platform.
   */
  async hasRequiredConsent(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dataConsentAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.dataConsentAt !== null;
  }

  /**
   * Return full consent status for the user.
   */
  async getConsentStatus(userId: string): Promise<ConsentStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dataConsentAt: true, sensitiveDataConsentAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      dataConsentAt: user.dataConsentAt,
      sensitiveDataConsentAt: user.sensitiveDataConsentAt,
      hasRequiredConsent: user.dataConsentAt !== null,
    };
  }
}

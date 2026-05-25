import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { ConsentType, CrisisLevel } from '@prisma/client';

import {
  ANONYMIZED_VALUE,
  CONSENT_FIELD_MAP,
  CONSENT_TYPE_MAP,
} from './consent.const.js';
import { ConsentRecord, ConsentStatus } from './consent.model.js';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grant GDPR consent of the specified type.
   * Creates an auditable Consent record and updates the User timestamp.
   */
  async grantConsent(
    userId: string,
    type: 'data' | 'sensitive',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ConsentRecord> {
    const consentType = CONSENT_TYPE_MAP[type] as ConsentType;
    const userField = CONSENT_FIELD_MAP[type];
    const now = new Date();

    const [consent] = await this.prisma.$transaction([
      this.prisma.consent.create({
        data: {
          userId,
          consentType,
          grantedAt: now,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { [userField]: now },
      }),
    ]);

    this.logger.log(`Consent granted: ${type} for user ${userId}`);
    return consent;
  }

  /**
   * Withdraw Art. 9 (sensitive data) consent.
   * - Blocked if user has an active crisis case (crisisLevel != NONE).
   * - Anonymizes sensitive fields on active non-crisis cases.
   * - Creates a withdrawn Consent record.
   * - Notifies consultant (MVP: logger).
   */
  async withdrawSensitiveConsent(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Check for active crisis cases — safeguarding override
    const activeCrisisCase = await this.prisma.careCase.findFirst({
      where: {
        personId: userId,
        crisisLevel: { not: CrisisLevel.NONE },
        closedAt: null,
      },
    });

    if (activeCrisisCase) {
      throw new ConflictException(
        'Cannot withdraw sensitive data consent while an active crisis case exists. ' +
          'This is required to maintain safeguarding obligations under Art. 9(2)(c) GDPR.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Create withdrawn consent record for audit trail
      await tx.consent.create({
        data: {
          userId,
          consentType: ConsentType.SENSITIVE_DATA,
          grantedAt: now,
          withdrawnAt: now,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      // Clear sensitive consent timestamp on user
      await tx.user.update({
        where: { id: userId },
        data: { sensitiveDataConsentAt: null },
      });

      // Anonymize sensitive fields on active non-crisis cases
      await tx.careCase.updateMany({
        where: {
          personId: userId,
          closedAt: null,
          crisisLevel: CrisisLevel.NONE,
        },
        data: {
          topic: ANONYMIZED_VALUE,
          description: ANONYMIZED_VALUE,
        },
      });
    });

    // MVP notification — consultant informed via log
    this.logger.warn(
      `[MVP NOTIFICATION] Sensitive data consent withdrawn for user ${userId}. ` +
        'Active non-crisis cases have been anonymized. Consultants should be notified.',
    );

    this.logger.log(
      `Sensitive data consent withdrawn for user ${userId}`,
    );
  }

  /**
   * Revoke consent — legacy method kept for backward compatibility.
   * @deprecated Use withdrawSensitiveConsent instead.
   */
  async revokeConsent(userId: string, _type: 'sensitive'): Promise<void> {
    return this.withdrawSensitiveConsent(userId);
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

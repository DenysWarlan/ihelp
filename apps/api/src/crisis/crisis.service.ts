import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import {
  CrisisLevel,
  CrisisRiskLevel,
  MessageChannel,
  Role,
} from '@prisma/client';

import {
  DEFAULT_AUTO_REPLY_TEMPLATE,
  DEFAULT_CRISIS_KEYWORDS,
  ESCALATION_REPEAT_MINUTES,
  MVP_NOTIFICATION_PREFIX,
  NOTIFICATION_CHAIN,
  RISK_TO_CRISIS_LEVEL,
  SYSTEM_SENDER_ID,
} from './crisis.const.js';
import {
  AutoReplyContext,
  CrisisScanInput,
  CrisisScanResult,
  EscalationContext,
  KeywordMatch,
} from './crisis.model.js';

// ---------------------------------------------------------------------------
// Risk level priority for comparison (higher number = higher severity)
// ---------------------------------------------------------------------------

const RISK_PRIORITY: Record<CrisisRiskLevel, number> = {
  [CrisisRiskLevel.LOW]: 1,
  [CrisisRiskLevel.MEDIUM]: 2,
  [CrisisRiskLevel.HIGH]: 3,
};

@Injectable()
export class CrisisService implements OnModuleInit {
  private readonly logger = new Logger(CrisisService.name);

  /** In-memory cache of active keywords, refreshed from DB on init. */
  private cachedKeywords: Array<{
    keyword: string;
    keywordLower: string;
    riskLevel: CrisisRiskLevel;
    language: string;
  }> = [];

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Lifecycle — seed defaults & load cache
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    await this.seedDefaultKeywords();
    await this.refreshKeywordCache();
    this.logger.log(
      `Crisis keyword cache loaded: ${this.cachedKeywords.length} active keywords`,
    );
  }

  // ---------------------------------------------------------------------------
  // S-E08-01: Scan message for crisis keywords
  // ---------------------------------------------------------------------------

  scanMessage(input: CrisisScanInput): CrisisScanResult {
    const textsToScan: string[] = [];

    // Add message content
    if (input.content) {
      textsToScan.push(input.content);
    }

    // Add attachment filenames and alt-text (S-E08-01 requirement)
    if (input.attachments) {
      for (const attachment of input.attachments) {
        if (attachment.fileName) {
          textsToScan.push(attachment.fileName);
        }
        if (attachment.altText) {
          textsToScan.push(attachment.altText);
        }
      }
    }

    if (textsToScan.length === 0) {
      return {
        detected: false,
        matches: [],
        highestRiskLevel: null,
        crisisLevel: CrisisLevel.NONE,
      };
    }

    // Combine all text for scanning (case-insensitive, Cyrillic-safe)
    const combinedText = textsToScan.join(' ').toLowerCase();

    const matches: KeywordMatch[] = [];

    for (const entry of this.cachedKeywords) {
      if (combinedText.includes(entry.keywordLower)) {
        matches.push({
          keyword: entry.keyword,
          riskLevel: entry.riskLevel,
          language: entry.language,
        });
      }
    }

    if (matches.length === 0) {
      return {
        detected: false,
        matches: [],
        highestRiskLevel: null,
        crisisLevel: CrisisLevel.NONE,
      };
    }

    // S-E08-02: Use the highest risk level among all matches
    const highestRiskLevel = this.getHighestRiskLevel(matches);
    const crisisLevel = this.mapRiskToCrisisLevel(highestRiskLevel);

    return {
      detected: true,
      matches,
      highestRiskLevel,
      crisisLevel,
    };
  }

  // ---------------------------------------------------------------------------
  // S-E08-02: Classify risk and update case crisis level
  // ---------------------------------------------------------------------------

  async updateCaseCrisisLevel(
    caseId: string,
    crisisLevel: CrisisLevel,
  ): Promise<void> {
    await this.prisma.careCase.update({
      where: { id: caseId },
      data: { crisisLevel },
    });

    this.logger.warn(
      `Case ${caseId} crisis level updated to ${crisisLevel}`,
    );
  }

  // ---------------------------------------------------------------------------
  // S-E08-03: Immediate escalation on HIGH risk (MVP: log-based)
  // ---------------------------------------------------------------------------

  async triggerEscalation(context: EscalationContext): Promise<string> {
    // Create CrisisAlert record
    const alert = await this.prisma.crisisAlert.create({
      data: {
        careCaseId: context.caseId,
        messageId: context.messageId,
        riskLevel: context.riskLevel,
        matchedKeywords: [...context.matchedKeywords],
      },
    });

    this.logger.warn(
      `CRISIS ALERT created: ${alert.id} for case ${context.caseId} ` +
        `(risk: ${context.riskLevel}, keywords: ${context.matchedKeywords.join(', ')})`,
    );

    // MVP: Log-based notification fallback chain (SMS -> push -> email -> phone)
    for (const channel of NOTIFICATION_CHAIN) {
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} ${channel} notification for crisis alert ${alert.id} ` +
          `— case: ${context.caseId}, risk: ${context.riskLevel}, ` +
          `keywords: [${context.matchedKeywords.join(', ')}]`,
      );
    }

    // MVP: Log reminder about re-escalation
    this.logger.warn(
      `${MVP_NOTIFICATION_PREFIX} If no acknowledgment in ${ESCALATION_REPEAT_MINUTES} minutes, ` +
        `crisis alert ${alert.id} should be re-escalated (MVP: manual check required)`,
    );

    return alert.id;
  }

  // ---------------------------------------------------------------------------
  // S-E08-04: Auto-reply with emergency line 7333
  // ---------------------------------------------------------------------------

  async sendAutoReply(context: AutoReplyContext): Promise<string | null> {
    // Fetch the active auto-reply template for the given language
    const template = await this.prisma.crisisAutoReply.findFirst({
      where: {
        language: context.language,
        isActive: true,
      },
    });

    const replyText = template?.template ?? DEFAULT_AUTO_REPLY_TEMPLATE;

    // Create a system message in the same case
    const autoReplyMessage = await this.prisma.message.create({
      data: {
        careCaseId: context.caseId,
        senderId: SYSTEM_SENDER_ID,
        senderRole: Role.CONSULTANT,
        channel: context.channel,
        content: replyText,
      },
    });

    this.logger.warn(
      `${MVP_NOTIFICATION_PREFIX} Auto-reply sent in case ${context.caseId}: ` +
        `message ${autoReplyMessage.id} via ${context.channel}`,
    );

    // Update the CrisisAlert to mark auto-reply as sent
    await this.prisma.crisisAlert.updateMany({
      where: {
        careCaseId: context.caseId,
        messageId: context.messageId,
        autoReplySent: false,
      },
      data: {
        autoReplySent: true,
      },
    });

    return autoReplyMessage.id;
  }

  // ---------------------------------------------------------------------------
  // Full crisis processing pipeline (called from MessageService)
  // ---------------------------------------------------------------------------

  async processMessage(
    caseId: string,
    messageId: string,
    input: CrisisScanInput,
    channel: MessageChannel,
    language?: string,
  ): Promise<CrisisScanResult> {
    const scanResult = this.scanMessage(input);

    if (!scanResult.detected) {
      return scanResult;
    }

    this.logger.warn(
      `Crisis keywords detected in message ${messageId} (case: ${caseId}): ` +
        `${scanResult.matches.map((m) => m.keyword).join(', ')} ` +
        `— highest risk: ${scanResult.highestRiskLevel}`,
    );

    // S-E08-02: Update case crisis level
    await this.updateCaseCrisisLevel(caseId, scanResult.crisisLevel);

    // Build escalation context
    const escalationContext: EscalationContext = {
      caseId,
      messageId,
      riskLevel: scanResult.highestRiskLevel!,
      matchedKeywords: scanResult.matches.map((m) => m.keyword),
      crisisLevel: scanResult.crisisLevel,
    };

    // S-E08-03 + S-E08-04: Run escalation and auto-reply in parallel for HIGH risk
    if (scanResult.highestRiskLevel === CrisisRiskLevel.HIGH) {
      const autoReplyContext: AutoReplyContext = {
        caseId,
        messageId,
        channel,
        language: language ?? 'uk',
      };

      await Promise.all([
        this.triggerEscalation(escalationContext),
        this.sendAutoReply(autoReplyContext),
      ]);
    } else {
      // For MEDIUM and LOW: create alert but no auto-reply
      await this.triggerEscalation(escalationContext);
    }

    return scanResult;
  }

  // ---------------------------------------------------------------------------
  // Keyword cache management
  // ---------------------------------------------------------------------------

  async refreshKeywordCache(): Promise<void> {
    const keywords = await this.prisma.crisisKeyword.findMany({
      where: { isActive: true },
    });

    this.cachedKeywords = keywords.map((kw) => ({
      keyword: kw.keyword,
      keywordLower: kw.keyword.toLowerCase(),
      riskLevel: kw.riskLevel,
      language: kw.language,
    }));
  }

  // ---------------------------------------------------------------------------
  // Seed default keywords (idempotent)
  // ---------------------------------------------------------------------------

  async seedDefaultKeywords(): Promise<void> {
    const existingCount = await this.prisma.crisisKeyword.count();

    if (existingCount > 0) {
      this.logger.debug(
        `Crisis keywords already seeded (${existingCount} found), skipping`,
      );
      return;
    }

    await this.prisma.crisisKeyword.createMany({
      data: DEFAULT_CRISIS_KEYWORDS.map((entry) => ({
        keyword: entry.keyword,
        language: entry.language,
        riskLevel: entry.riskLevel,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Seeded ${DEFAULT_CRISIS_KEYWORDS.length} default crisis keywords`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getHighestRiskLevel(
    matches: readonly KeywordMatch[],
  ): CrisisRiskLevel {
    let highest = matches[0].riskLevel;

    for (const match of matches) {
      if (RISK_PRIORITY[match.riskLevel] > RISK_PRIORITY[highest]) {
        highest = match.riskLevel;
      }
    }

    return highest;
  }

  private mapRiskToCrisisLevel(riskLevel: CrisisRiskLevel): CrisisLevel {
    return RISK_TO_CRISIS_LEVEL[riskLevel];
  }
}

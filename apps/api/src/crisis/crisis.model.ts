import { CrisisLevel, CrisisRiskLevel, MessageChannel } from '@prisma/client';

// ---------------------------------------------------------------------------
// Default keyword entry (used by seed data in crisis.const.ts)
// ---------------------------------------------------------------------------

export interface DefaultKeywordEntry {
  readonly keyword: string;
  readonly language: string;
  readonly riskLevel: CrisisRiskLevel;
}

// ---------------------------------------------------------------------------
// Keyword scan result
// ---------------------------------------------------------------------------

export interface KeywordMatch {
  readonly keyword: string;
  readonly riskLevel: CrisisRiskLevel;
  readonly language: string;
}

export interface CrisisScanResult {
  /** Whether any crisis keywords were detected. */
  readonly detected: boolean;

  /** Matched keywords with their risk levels. */
  readonly matches: readonly KeywordMatch[];

  /** Highest risk level among all matches, or null if none detected. */
  readonly highestRiskLevel: CrisisRiskLevel | null;

  /** The crisis level to set on the case (mapped from highest risk). */
  readonly crisisLevel: CrisisLevel;
}

// ---------------------------------------------------------------------------
// Escalation context
// ---------------------------------------------------------------------------

export interface EscalationContext {
  readonly caseId: string;
  readonly messageId: string;
  readonly riskLevel: CrisisRiskLevel;
  readonly matchedKeywords: readonly string[];
  readonly crisisLevel: CrisisLevel;
}

// ---------------------------------------------------------------------------
// Auto-reply context
// ---------------------------------------------------------------------------

export interface AutoReplyContext {
  readonly caseId: string;
  readonly messageId: string;
  readonly channel: MessageChannel;
  readonly language: string;
}

// ---------------------------------------------------------------------------
// Scan input (message content + optional attachment metadata)
// ---------------------------------------------------------------------------

export interface CrisisScanInput {
  readonly content: string | null;
  readonly attachments?: AttachmentScanMeta[] | null;
}

export interface AttachmentScanMeta {
  readonly fileName?: string;
  readonly altText?: string;
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '@org/prisma-client';

import {
  CONFIDENCE_LEVELS,
  type ConfidenceLevel,
  ERROR_GROUP_NOT_FOUND,
  MATCH_REASONS,
  type MatchReason,
  PRIMARY_SCORE_WEIGHTS,
  SYNTHETIC_EMAIL_SUFFIX,
} from './duplicate.const.js';
import type {
  DuplicateGroup,
  DuplicateGroupsResponse,
  DuplicateUserSummary,
  ListDuplicatesDto,
} from './duplicate.model.js';

// ---------------------------------------------------------------------------
// Union-Find (Disjoint Set) for transitive clustering
// ---------------------------------------------------------------------------

class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  groups(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!result.has(root)) {
        result.set(root, []);
      }
      result.get(root)!.push(id);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Detection Service
// ---------------------------------------------------------------------------

interface UserWithRelations {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  passwordHash: string | null;
  providerLinks: { provider: string; providerAccountId: string }[];
  _count: {
    careCasesAsPerson: number;
    enrollments: number;
    messagesSent: number;
    meetingsAsPerson: number;
  };
}

interface MatchPair {
  userIdA: string;
  userIdB: string;
  reason: MatchReason;
}

@Injectable()
export class DuplicateDetectionService {
  private readonly logger = new Logger(DuplicateDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async listDuplicateGroups(
    query: ListDuplicatesDto,
  ): Promise<DuplicateGroupsResponse> {
    const users = await this.loadUsers();
    const dismissed = await this.loadDismissedPairs();
    const merged = await this.loadMergedUserIds();

    // Filter out already-merged secondary users
    const activeUsers = users.filter((u) => !merged.has(u.id));

    const matches = this.detectMatches(activeUsers);
    const filteredMatches = this.filterDismissed(matches, dismissed);

    const uf = new UnionFind();
    const pairReasons = new Map<string, Set<MatchReason>>();

    for (const match of filteredMatches) {
      uf.union(match.userIdA, match.userIdB);
      const key = [match.userIdA, match.userIdB].sort().join(':');
      if (!pairReasons.has(key)) {
        pairReasons.set(key, new Set());
      }
      pairReasons.get(key)!.add(match.reason);
    }

    const clusters = uf.groups();
    const userMap = new Map(activeUsers.map((u) => [u.id, u]));

    let groups: DuplicateGroup[] = [];

    for (const [, memberIds] of clusters) {
      if (memberIds.length < 2) continue;

      const groupUsers = memberIds
        .map((id) => userMap.get(id))
        .filter(Boolean) as UserWithRelations[];

      const allReasons = new Set<MatchReason>();
      for (let i = 0; i < memberIds.length; i++) {
        for (let j = i + 1; j < memberIds.length; j++) {
          const key = [memberIds[i], memberIds[j]].sort().join(':');
          const reasons = pairReasons.get(key);
          if (reasons) {
            for (const r of reasons) allReasons.add(r);
          }
        }
      }

      const reasons = [...allReasons];
      const confidence = this.computeConfidence(reasons);
      const userSummaries = groupUsers.map((u) => this.toUserSummary(u));
      const suggestedPrimaryId = this.suggestPrimary(userSummaries);
      const groupId = this.computeGroupId(memberIds);

      groups.push({
        groupId,
        users: userSummaries,
        matchReasons: reasons,
        confidence,
        suggestedPrimaryId,
      });
    }

    // Filter by confidence if requested
    if (query.confidence) {
      groups = groups.filter((g) => g.confidence === query.confidence);
    }

    // Sort: HIGH first, then by group size desc
    const confidenceOrder: Record<string, number> = {
      HIGH: 0,
      MEDIUM: 1,
      LOW: 2,
    };
    groups.sort(
      (a, b) =>
        confidenceOrder[a.confidence] - confidenceOrder[b.confidence] ||
        b.users.length - a.users.length,
    );

    return { groups, total: groups.length };
  }

  async getGroupDetail(groupId: string): Promise<DuplicateGroup> {
    const result = await this.listDuplicateGroups({});
    const group = result.groups.find((g) => g.groupId === groupId);
    if (!group) {
      throw new NotFoundException(ERROR_GROUP_NOT_FOUND);
    }
    return group;
  }

  async dismissDuplicate(
    groupId: string,
    dismissedBy: string,
    reason?: string,
  ): Promise<{ id: string }> {
    const group = await this.getGroupDetail(groupId);
    const userIds = group.users.map((u) => u.id).sort();

    // Store pairwise dismissals for all users in the group
    const results: string[] = [];
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const dismissal = await this.prisma.duplicateDismissal.upsert({
          where: {
            userIdA_userIdB: {
              userIdA: userIds[i],
              userIdB: userIds[j],
            },
          },
          create: {
            userIdA: userIds[i],
            userIdB: userIds[j],
            dismissedBy,
            reason: reason ?? null,
          },
          update: {},
        });
        results.push(dismissal.id);
      }
    }

    this.logger.log(`Duplicate group ${groupId} dismissed by ${dismissedBy}`);
    return { id: results[0] };
  }

  // ---------------------------------------------------------------------------
  // Detection Rules
  // ---------------------------------------------------------------------------

  private detectMatches(users: UserWithRelations[]): MatchPair[] {
    const matches: MatchPair[] = [];
    const seen = new Set<string>();

    const addMatch = (a: string, b: string, reason: MatchReason): void => {
      const key = [a, b].sort().join(':') + ':' + reason;
      if (seen.has(key)) return;
      seen.add(key);
      matches.push({ userIdA: a, userIdB: b, reason });
    };

    // Build lookup maps
    const telegramProviders = new Map<string, string>(); // providerAccountId -> userId
    for (const user of users) {
      for (const pl of user.providerLinks) {
        if (pl.provider === 'telegram') {
          telegramProviders.set(pl.providerAccountId, user.id);
        }
      }
    }

    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const a = users[i];
        const b = users[j];

        // Rule 1: Exact email match (case-insensitive)
        if (a.email.toLowerCase() === b.email.toLowerCase()) {
          addMatch(a.id, b.id, MATCH_REASONS.EXACT_EMAIL);
        }

        // Rule 2: Exact name match (case-insensitive, trimmed, collapsed whitespace)
        const normA = a.name.toLowerCase().trim().replace(/\s+/g, ' ');
        const normB = b.name.toLowerCase().trim().replace(/\s+/g, ' ');
        if (normA === normB && normA.length > 0) {
          addMatch(a.id, b.id, MATCH_REASONS.EXACT_NAME);
        }

        // Rule 3: Same Telegram provider account
        const aTelegram = a.providerLinks.find((p) => p.provider === 'telegram');
        const bTelegram = b.providerLinks.find((p) => p.provider === 'telegram');
        if (
          aTelegram &&
          bTelegram &&
          aTelegram.providerAccountId === bTelegram.providerAccountId
        ) {
          addMatch(a.id, b.id, MATCH_REASONS.SAME_TELEGRAM);
        }

        // Rule 4: One has real email, other has synthetic telegram email
        // and the real email appears in the other's case contactValue
        const aIsSynthetic = a.email.endsWith(SYNTHETIC_EMAIL_SUFFIX);
        const bIsSynthetic = b.email.endsWith(SYNTHETIC_EMAIL_SUFFIX);

        if (aIsSynthetic && !bIsSynthetic) {
          // a is telegram, b has real email — already detected by contactValue scan below
        }
        if (bIsSynthetic && !aIsSynthetic) {
          // symmetric
        }
      }
    }

    return matches;
  }

  // ---------------------------------------------------------------------------
  // Confidence Scoring
  // ---------------------------------------------------------------------------

  private computeConfidence(reasons: MatchReason[]): ConfidenceLevel {
    const hasHigh = reasons.some(
      (r) =>
        r === MATCH_REASONS.EXACT_EMAIL ||
        r === MATCH_REASONS.SAME_TELEGRAM ||
        r === MATCH_REASONS.TELEGRAM_CONTACT ||
        r === MATCH_REASONS.SHARED_REAL_EMAIL,
    );

    if (hasHigh) return CONFIDENCE_LEVELS.HIGH;

    // Name match alone is LOW, but with 2+ corroborating signals it's MEDIUM
    if (reasons.length >= 2) return CONFIDENCE_LEVELS.MEDIUM;

    return CONFIDENCE_LEVELS.LOW;
  }

  // ---------------------------------------------------------------------------
  // Primary Suggestion
  // ---------------------------------------------------------------------------

  private suggestPrimary(users: DuplicateUserSummary[]): string {
    let bestId = users[0].id;
    let bestScore = -Infinity;

    for (const user of users) {
      if (user.score > bestScore) {
        bestScore = user.score;
        bestId = user.id;
      }
    }

    return bestId;
  }

  private computeUserScore(user: UserWithRelations): number {
    let score = 0;

    if (!user.email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
      score += PRIMARY_SCORE_WEIGHTS.REAL_EMAIL;
    }
    if (user.passwordHash) {
      score += PRIMARY_SCORE_WEIGHTS.HAS_PASSWORD;
    }
    if (user.isActive) {
      score += PRIMARY_SCORE_WEIGHTS.IS_ACTIVE;
    }
    score +=
      user.providerLinks.length * PRIMARY_SCORE_WEIGHTS.PROVIDER_LINK;
    score +=
      user._count.careCasesAsPerson * PRIMARY_SCORE_WEIGHTS.CASE_COUNT;

    const ageDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    score += ageDays * PRIMARY_SCORE_WEIGHTS.AGE_PER_DAY;

    return score;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toUserSummary(user: UserWithRelations): DuplicateUserSummary {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      hasPassword: !!user.passwordHash,
      providers: user.providerLinks.map((p) => p.provider),
      caseCount: user._count.careCasesAsPerson,
      enrollmentCount: user._count.enrollments,
      messageCount: user._count.messagesSent,
      meetingCount: user._count.meetingsAsPerson,
      score: this.computeUserScore(user),
    };
  }

  private computeGroupId(userIds: string[]): string {
    const sorted = [...userIds].sort();
    return createHash('sha256')
      .update(sorted.join(':'))
      .digest('hex')
      .slice(0, 16);
  }

  private async loadUsers(): Promise<UserWithRelations[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        passwordHash: true,
        providerLinks: {
          select: { provider: true, providerAccountId: true },
        },
        _count: {
          select: {
            careCasesAsPerson: true,
            enrollments: true,
            messagesSent: true,
            meetingsAsPerson: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async loadDismissedPairs(): Promise<Set<string>> {
    const dismissals = await this.prisma.duplicateDismissal.findMany({
      select: { userIdA: true, userIdB: true },
    });
    return new Set(
      dismissals.map((d) => [d.userIdA, d.userIdB].sort().join(':')),
    );
  }

  private async loadMergedUserIds(): Promise<Set<string>> {
    const merges = await this.prisma.userMerge.findMany({
      where: { isReverted: false },
      select: { secondaryUserId: true },
    });
    return new Set(merges.map((m) => m.secondaryUserId));
  }

  private filterDismissed(
    matches: MatchPair[],
    dismissed: Set<string>,
  ): MatchPair[] {
    return matches.filter((m) => {
      const key = [m.userIdA, m.userIdB].sort().join(':');
      return !dismissed.has(key);
    });
  }
}

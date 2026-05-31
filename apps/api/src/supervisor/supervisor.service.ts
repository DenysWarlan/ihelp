import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

import {
  AddCommentResponse,
  CaseListItem,
  CrisisHistoryItem,
  SupervisorCaseDetail,
} from './supervisor.model.js';

@Injectable()
export class SupervisorService {
  private readonly logger = new Logger(SupervisorService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /supervisor/cases — list all cases with consultant names
  // ---------------------------------------------------------------------------

  async getCases(): Promise<CaseListItem[]> {
    const cases = await this.prisma.careCase.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        topic: true,
        status: true,
        priority: true,
        createdAt: true,
        person: {
          select: { name: true },
        },
        consultant: {
          select: { name: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    return cases.map((c) => ({
      id: c.id,
      personName: c.person.name,
      topic: c.topic,
      status: c.status,
      priority: c.priority,
      assignedAt: c.createdAt,
      lastMessageAt: c.messages[0]?.createdAt ?? null,
      consultantName: c.consultant?.name ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // GET /supervisor/cases/:id — case detail (read-only supervisor view)
  // ---------------------------------------------------------------------------

  async getCaseDetail(caseId: string): Promise<SupervisorCaseDetail> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        topic: true,
        status: true,
        priority: true,
        createdAt: true,
        person: {
          select: { name: true },
        },
        consultant: {
          select: { name: true },
        },
        slaTimer: {
          select: { startedAt: true, status: true },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            senderRole: true,
            createdAt: true,
            sender: {
              select: { name: true },
            },
          },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!careCase) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    return {
      id: careCase.id,
      personName: careCase.person.name,
      consultantName: careCase.consultant?.name ?? null,
      topic: careCase.topic,
      status: careCase.status,
      priority: careCase.priority,
      createdAt: careCase.createdAt,
      slaDeadline: careCase.slaTimer?.startedAt ?? null,
      messages: careCase.messages.map((m) => ({
        id: m.id,
        content: m.content,
        authorName: m.sender?.name ?? 'System',
        authorRole: m.senderRole,
        createdAt: m.createdAt,
      })),
      consultantNotes: careCase.notes.map((n) => ({
        id: n.id,
        content: n.content,
        authorName: n.author.name,
        createdAt: n.createdAt,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // POST /supervisor/cases/:id/comment — add supervisor comment
  // ---------------------------------------------------------------------------

  async addComment(
    caseId: string,
    supervisorId: string,
    comment: string,
  ): Promise<AddCommentResponse> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    const note = await this.prisma.caseNote.create({
      data: {
        careCaseId: caseId,
        authorId: supervisorId,
        content: comment,
        isSupervisorNote: true,
      },
    });

    this.logger.log(
      `Supervisor ${supervisorId} added comment ${note.id} to case ${caseId}`,
    );

    return {
      id: note.id,
      careCaseId: note.careCaseId,
      content: note.content,
      createdAt: note.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /supervisor/crisis-history — crisis alert history
  // ---------------------------------------------------------------------------

  async getCrisisHistory(): Promise<CrisisHistoryItem[]> {
    const alerts = await this.prisma.crisisAlert.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        riskLevel: true,
        matchedKeywords: true,
        acknowledgedAt: true,
        acknowledgedBy: true,
        autoReplySent: true,
        createdAt: true,
        careCaseId: true,
        messageId: true,
      },
    });

    // Fetch related case data for each alert
    const caseIds = [...new Set(alerts.map((a) => a.careCaseId))];
    const messageIds = [...new Set(alerts.map((a) => a.messageId))];

    const [cases, messages] = await Promise.all([
      this.prisma.careCase.findMany({
        where: { id: { in: caseIds } },
        select: {
          id: true,
          status: true,
          person: { select: { name: true } },
          consultant: { select: { name: true } },
        },
      }),
      this.prisma.message.findMany({
        where: { id: { in: messageIds } },
        select: {
          id: true,
          sender: { select: { name: true } },
        },
      }),
    ]);

    const caseMap = new Map(cases.map((c) => [c.id, c]));
    const messageMap = new Map(messages.map((m) => [m.id, m]));

    return alerts.map((alert) => {
      const relatedCase = caseMap.get(alert.careCaseId);
      const relatedMessage = messageMap.get(alert.messageId);

      return {
        id: alert.id,
        detectedAt: alert.createdAt,
        authorName: relatedMessage?.sender?.name ?? 'Unknown',
        consultantName: relatedCase?.consultant?.name ?? null,
        clientName: relatedCase?.person.name ?? 'Unknown',
        severity: alert.riskLevel,
        status: alert.acknowledgedAt ? 'ACKNOWLEDGED' : 'PENDING',
        action: alert.autoReplySent ? 'AUTO_REPLY_SENT' : 'ESCALATED',
        isEscalated: !alert.acknowledgedAt,
      };
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Prisma } from '@prisma/client';

import { DEFAULT_PAGE_SIZE } from './admin.const.js';
import {
  AuditLogEntry,
  ListAuditLogDto,
  PaginatedAuditLogResponse,
} from './admin.model.js';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // S-E13-10: Paginated, filterable audit log
  // ---------------------------------------------------------------------------

  async listAuditLogs(
    query: ListAuditLogDto,
  ): Promise<PaginatedAuditLogResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => this.toAuditLogEntry(log)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toAuditLogEntry(log: {
    id: string;
    userId: string | null;
    action: string;
    details: string | null;
    ipAddress: string | null;
    createdAt: Date;
  }): AuditLogEntry {
    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    };
  }
}

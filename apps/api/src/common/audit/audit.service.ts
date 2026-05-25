import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { AuditLog } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry for a security-relevant event.
   * This is fire-and-forget — callers should not await this in critical paths
   * unless they need to guarantee the log is persisted before continuing.
   */
  async log(
    action: string,
    userId?: string,
    details?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action,
        userId,
        details,
        ipAddress,
      },
    });

    this.logger.log(
      `AUDIT: action=${action} user=${userId ?? 'anonymous'} ip=${ipAddress ?? 'unknown'}`,
    );
  }

  /**
   * Retrieve audit log entries by action type (for review / incident response).
   */
  async getByAction(action: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
    });
  }
}

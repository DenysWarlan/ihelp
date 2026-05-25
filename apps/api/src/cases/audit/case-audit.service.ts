import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

export interface AuditEntryResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly details: unknown;
  readonly createdAt: Date;
}

@Injectable()
export class CaseAuditService {
  private readonly logger = new Logger(CaseAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(careCaseId: string): Promise<AuditEntryResponse[]> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    const entries = await this.prisma.caseAuditEntry.findMany({
      where: { careCaseId },
      orderBy: { createdAt: 'desc' },
    });

    return entries;
  }
}

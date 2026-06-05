import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, ConsultantStatus } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { AUTO_ASSIGN_ROLES } from './assignment.const.js';
import { ConfirmAssignmentDto } from './assignment.model.js';
import { AssignmentService } from './assignment.service.js';

@ApiTags('assignment')
@ApiBearerAuth()
@Controller('assignment')
export class AssignmentSuggestionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: AssignmentService,
  ) {}

  @Get('suggestions')
  @Roles(...AUTO_ASSIGN_ROLES)
  @ApiOperation({
    summary: 'Get assignment suggestions for unassigned cases',
    description:
      'Returns unassigned cases with a suggested consultant based on ' +
      'specialization match, availability, and current workload.',
  })
  @ApiResponse({ status: 200, description: 'Assignment suggestions' })
  async getSuggestions() {
    const unassignedCases = await this.prisma.careCase.findMany({
      where: {
        status: CaseStatus.NEW,
        consultantId: null,
      },
      include: {
        person: {
          select: { name: true },
        },
        tags: {
          select: { tag: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const consultants = await this.prisma.consultantProfile.findMany({
      where: {
        status: { in: [ConsultantStatus.AVAILABLE, ConsultantStatus.BUSY] },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { currentCases: 'asc' },
    });

    return unassignedCases.map((c) => {
      const caseTags = c.tags.map((t) => t.tag);
      const now = new Date();
      const waitMs = now.getTime() - c.createdAt.getTime();
      const waitHours = Math.floor(waitMs / 3_600_000);
      const waitMinutes = Math.floor((waitMs % 3_600_000) / 60_000);
      const waitTime =
        waitHours > 0 ? `${waitHours}г ${waitMinutes}хв` : `${waitMinutes}хв`;

      // Find best consultant: prefer one with matching specialization + most free slots
      let best = consultants[0] ?? null;
      let bestScore = -1;

      for (const con of consultants) {
        if (con.currentCases >= con.maxCases) continue;
        const specMatch = con.specializations.some((s) =>
          caseTags.includes(s) || (c.topic ?? '').toLowerCase().includes(s.toLowerCase()),
        );
        const freeSlots = con.maxCases - con.currentCases;
        const score =
          (specMatch ? 100 : 0) +
          (con.status === ConsultantStatus.AVAILABLE ? 10 : 0) +
          freeSlots;

        if (score > bestScore) {
          bestScore = score;
          best = con;
        }
      }

      const priority =
        c.crisisLevel === 'CRITICAL' || c.crisisLevel === 'HIGH'
          ? 'HIGH'
          : waitHours >= 4
            ? 'MEDIUM'
            : 'LOW';

      return {
        caseId: c.id,
        personName: c.person?.name ?? '',
        topic: c.topic ?? '',
        tags: caseTags,
        priority,
        waitTime,
        suggestedConsultantId: best?.userId ?? '',
        suggestedConsultantName: best?.user?.name ?? '',
        suggestedConsultantSpecialization:
          best?.specializations?.[0] ?? '',
        suggestedConsultantCaseCount: best?.currentCases ?? 0,
        reason: best
          ? best.specializations.some((s) =>
              caseTags.includes(s) || (c.topic ?? '').toLowerCase().includes(s.toLowerCase()),
            )
            ? 'Спеціалізація збігається'
            : 'Найменше навантаження'
          : 'Немає доступних консультантів',
      };
    });
  }

  @Post(':caseId/confirm')
  @Roles(...AUTO_ASSIGN_ROLES)
  @ApiOperation({
    summary: 'Confirm assignment suggestion',
    description: 'Assigns the suggested consultant to the case.',
  })
  @ApiResponse({ status: 201, description: 'Assignment confirmed' })
  async confirmAssignment(
    @Param('caseId', ParseUuidPipe) caseId: string,
    @Body() dto: ConfirmAssignmentDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.careCase.update({
        where: { id: caseId },
        data: {
          consultantId: dto.consultantId,
          status: CaseStatus.IN_PROGRESS,
        },
      });

      await tx.consultantProfile.updateMany({
        where: { userId: dto.consultantId },
        data: { currentCases: { increment: 1 } },
      });
    });

    return { success: true, caseId };
  }

  @Post(':caseId/reject')
  @Roles(...AUTO_ASSIGN_ROLES)
  @ApiOperation({
    summary: 'Reject assignment suggestion',
    description: 'Rejects the suggestion and keeps the case unassigned.',
  })
  @ApiResponse({ status: 201, description: 'Suggestion rejected' })
  async rejectAssignment(
    @Param('caseId', ParseUuidPipe) caseId: string,
  ) {
    return { success: true, caseId };
  }
}

import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '@org/prisma-client';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CRISIS_AUDIT_ACTIONS, MVP_NOTIFICATION_PREFIX } from './crisis.const.js';
import { CrisisAlertResponse } from './crisis.model.js';

// ===========================================================================
// S-E08-09: Crisis Alert Acknowledgment (with MFA bypass)
// ===========================================================================

@ApiTags('crisis')
@ApiBearerAuth()
@Controller('crisis/alerts')
export class CrisisAlertController {
  private readonly logger = new Logger(CrisisAlertController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('COORDINATOR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'List crisis alerts' })
  @ApiOkResponse({ description: 'List of crisis alerts' })
  async listAlerts() {
    const alerts = await this.prisma.crisisAlert.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        careCase: {
          select: { name: true, person: { select: { name: true } } },
        },
      },
      take: 50,
    });

    return alerts.map((alert) => {
      const personName =
        alert.careCase.name ?? alert.careCase.person.name ?? '—';

      return {
        id: alert.id,
        caseId: alert.careCaseId,
        personName,
        keyword: alert.matchedKeywords.join(', ') || '—',
        severity: alert.riskLevel as 'HIGH' | 'CRITICAL',
        detectedAt: alert.createdAt.toISOString(),
        isAcknowledged: alert.acknowledgedAt !== null,
      };
    });
  }

  @Post(':alertId/acknowledge')
  @Roles('COORDINATOR', 'ADMIN', 'SUPERVISOR', 'CONSULTANT')
  @ApiOperation({
    summary: 'Acknowledge a crisis alert',
    description:
      'Acknowledges a crisis alert. If the user has an active session, ' +
      'MFA verification is skipped (S-E08-09). The bypass is logged in audit.',
  })
  @ApiResponse({ status: 201, description: 'Alert acknowledged' })
  @ApiNotFoundResponse({ description: 'Alert not found' })
  async acknowledge(
    @Param('alertId', ParseUuidPipe) alertId: string,
    @Req() req: Request,
  ): Promise<CrisisAlertResponse> {
    const actor = req.user as JwtPayload;

    const alert = await this.prisma.crisisAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Crisis alert ${alertId} not found`);
    }

    if (alert.acknowledgedAt) {
      // Already acknowledged — return as-is
      return alert;
    }

    // S-E08-09: If user has an active session (JWT valid = active session),
    // skip MFA check and log the bypass
    const hasActiveSession = !!actor.sub;

    if (hasActiveSession) {
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} MFA bypass for crisis alert acknowledgment: ` +
          `user ${actor.sub} (${actor.email}) acknowledged alert ${alertId} ` +
          `with active session — MFA skipped`,
      );

      // Log MFA bypass in audit
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} Audit: ${CRISIS_AUDIT_ACTIONS.MFA_BYPASS} — ` +
          `user=${actor.sub}, alert=${alertId}, action=${CRISIS_AUDIT_ACTIONS.ALERT_ACKNOWLEDGED}`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.crisisAlert.update({
      where: { id: alertId },
      data: {
        acknowledgedAt: now,
        acknowledgedBy: actor.sub,
      },
    });

    this.logger.log(
      `Crisis alert ${alertId} acknowledged by user ${actor.sub} at ${now.toISOString()}`,
    );

    return updated;
  }
}

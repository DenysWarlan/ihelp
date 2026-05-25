import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Role } from '@prisma/client';

import {
  BUSINESS_HOURS_END_KEY,
  BUSINESS_HOURS_START_KEY,
  DEFAULT_BUSINESS_HOURS_END,
  DEFAULT_BUSINESS_HOURS_START,
  DEFAULT_TIMEZONE_OFFSET_HOURS,
  DUTY_GAP_CHECK_HOURS,
  MVP_NOTIFICATION_PREFIX,
  TIMEZONE_OFFSET_KEY,
} from './crisis.const.js';
import { DutyGap } from './crisis.model.js';

@Injectable()
export class DutyService {
  private readonly logger = new Logger(DutyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // S-E08-07: Find current on-duty person
  // ---------------------------------------------------------------------------

  /**
   * Returns the user ID of the person currently on duty, or null if none.
   */
  async findCurrentOnDutyUserId(now?: Date): Promise<string | null> {
    const currentTime = now ?? new Date();

    const schedule = await this.prisma.dutySchedule.findFirst({
      where: {
        isActive: true,
        startTime: { lte: currentTime },
        endTime: { gt: currentTime },
      },
      orderBy: { startTime: 'desc' },
    });

    return schedule?.userId ?? null;
  }

  // ---------------------------------------------------------------------------
  // S-E08-07: Check if current time is within business hours
  // ---------------------------------------------------------------------------

  async isWithinBusinessHours(now?: Date): Promise<boolean> {
    const currentTime = now ?? new Date();

    const settings = await this.prisma.organizationSettings.findMany({
      where: {
        key: {
          in: [
            BUSINESS_HOURS_START_KEY,
            BUSINESS_HOURS_END_KEY,
            TIMEZONE_OFFSET_KEY,
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    const startStr =
      settingsMap.get(BUSINESS_HOURS_START_KEY) ??
      DEFAULT_BUSINESS_HOURS_START;
    const endStr =
      settingsMap.get(BUSINESS_HOURS_END_KEY) ?? DEFAULT_BUSINESS_HOURS_END;
    const offsetHours = parseInt(
      settingsMap.get(TIMEZONE_OFFSET_KEY) ??
        String(DEFAULT_TIMEZONE_OFFSET_HOURS),
      10,
    );

    // Convert current UTC time to local time
    const localHour =
      currentTime.getUTCHours() + offsetHours;
    const localMinute = currentTime.getUTCMinutes();
    const localTimeMinutes =
      (((localHour % 24) + 24) % 24) * 60 + localMinute;

    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return localTimeMinutes >= startMinutes && localTimeMinutes < endMinutes;
  }

  // ---------------------------------------------------------------------------
  // S-E08-07: Get escalation target — duty person or all supervisors
  // ---------------------------------------------------------------------------

  /**
   * Returns user IDs to route crisis alerts to.
   * - During business hours: all supervisors (standard flow)
   * - Outside business hours: on-duty person if configured, else all supervisors
   */
  async getEscalationTargets(now?: Date): Promise<string[]> {
    const currentTime = now ?? new Date();
    const isBusinessHours = await this.isWithinBusinessHours(currentTime);

    if (isBusinessHours) {
      return this.getAllSupervisorIds();
    }

    // Outside business hours: try duty person first
    const dutyUserId = await this.findCurrentOnDutyUserId(currentTime);

    if (dutyUserId) {
      this.logger.log(
        `Night duty routing: alert routed to on-duty user ${dutyUserId}`,
      );
      return [dutyUserId];
    }

    // Fallback: all supervisors
    this.logger.warn(
      `${MVP_NOTIFICATION_PREFIX} No duty person configured for current time. ` +
        `Falling back to all supervisors.`,
    );
    return this.getAllSupervisorIds();
  }

  // ---------------------------------------------------------------------------
  // S-E08-08: Check for scheduling gaps in next N hours
  // ---------------------------------------------------------------------------

  async checkDutyGaps(
    hoursAhead?: number,
  ): Promise<DutyGap[]> {
    const checkHours = hoursAhead ?? DUTY_GAP_CHECK_HOURS;
    const now = new Date();
    const endWindow = new Date(now.getTime() + checkHours * 60 * 60 * 1000);

    // Get business hours config
    const isBusinessHoursNow = await this.isWithinBusinessHours(now);

    // Fetch all active duty schedules in the window
    const schedules = await this.prisma.dutySchedule.findMany({
      where: {
        isActive: true,
        endTime: { gt: now },
        startTime: { lt: endWindow },
      },
      orderBy: { startTime: 'asc' },
    });

    // Get business hours settings for gap analysis
    const settings = await this.prisma.organizationSettings.findMany({
      where: {
        key: {
          in: [
            BUSINESS_HOURS_START_KEY,
            BUSINESS_HOURS_END_KEY,
            TIMEZONE_OFFSET_KEY,
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const startStr =
      settingsMap.get(BUSINESS_HOURS_START_KEY) ??
      DEFAULT_BUSINESS_HOURS_START;
    const endStr =
      settingsMap.get(BUSINESS_HOURS_END_KEY) ?? DEFAULT_BUSINESS_HOURS_END;
    const offsetHours = parseInt(
      settingsMap.get(TIMEZONE_OFFSET_KEY) ??
        String(DEFAULT_TIMEZONE_OFFSET_HOURS),
      10,
    );

    // Identify non-business-hour periods within the window that have no duty coverage
    const gaps: DutyGap[] = [];
    const checkIntervalMs = 60 * 60 * 1000; // Check hourly slots

    for (
      let t = now.getTime();
      t < endWindow.getTime();
      t += checkIntervalMs
    ) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + checkIntervalMs);

      // Check if this slot is outside business hours
      const localHour =
        ((slotStart.getUTCHours() + offsetHours) % 24 + 24) % 24;
      const localMinute = slotStart.getUTCMinutes();
      const localTimeMinutes = localHour * 60 + localMinute;

      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);
      const bStart = startH * 60 + startM;
      const bEnd = endH * 60 + endM;

      const isBusinessHourSlot =
        localTimeMinutes >= bStart && localTimeMinutes < bEnd;

      if (isBusinessHourSlot) {
        continue; // Business hours have standard supervisor coverage
      }

      // Check if any duty schedule covers this slot
      const hasCoverage = schedules.some(
        (s) =>
          s.startTime.getTime() <= slotStart.getTime() &&
          s.endTime.getTime() >= slotEnd.getTime(),
      );

      if (!hasCoverage) {
        // Merge with previous gap if contiguous
        const lastGap = gaps[gaps.length - 1];
        if (lastGap && lastGap.end.getTime() === slotStart.getTime()) {
          gaps[gaps.length - 1] = { start: lastGap.start, end: slotEnd };
        } else {
          gaps.push({ start: slotStart, end: slotEnd });
        }
      }
    }

    if (gaps.length > 0) {
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} Duty schedule gaps detected in next ${checkHours}h: ` +
          `${gaps.length} gap(s) found`,
      );
      for (const gap of gaps) {
        this.logger.warn(
          `${MVP_NOTIFICATION_PREFIX} Gap: ${gap.start.toISOString()} → ${gap.end.toISOString()}`,
        );
      }
    } else {
      this.logger.log(
        `Duty schedule check passed: full coverage for next ${checkHours}h`,
      );
    }

    return gaps;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getAllSupervisorIds(): Promise<string[]> {
    const supervisors = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.SUPERVISOR, Role.COORDINATOR, Role.ADMIN] },
        isActive: true,
      },
      select: { id: true },
    });

    return supervisors.map((s) => s.id);
  }
}

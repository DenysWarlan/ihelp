import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

import { WEEKLY_SCHEDULE_DAYS } from './admin.const.js';
import {
  DutyScheduleEntry,
  ScheduleOverlap,
  WeeklyScheduleDay,
  WeeklyScheduleResponse,
} from './admin.model.js';

@Injectable()
export class AdminDutyService {
  private readonly logger = new Logger(AdminDutyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // S-E13-09: Weekly recurring schedule view with overlap/gap warnings
  // ---------------------------------------------------------------------------

  async getWeeklySchedule(
    startDateStr?: string,
  ): Promise<WeeklyScheduleResponse> {
    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    // Normalize to start of day (UTC)
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + WEEKLY_SCHEDULE_DAYS);

    // Fetch all schedules in the window
    const schedules = await this.prisma.dutySchedule.findMany({
      where: {
        OR: [
          // Schedules that overlap with our window
          {
            startTime: { lt: endDate },
            endTime: { gt: startDate },
          },
        ],
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const days: WeeklyScheduleDay[] = [];
    const allOverlaps: ScheduleOverlap[] = [];
    let totalGaps = 0;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let d = 0; d < WEEKLY_SCHEDULE_DAYS; d++) {
      const dayStart = new Date(startDate);
      dayStart.setUTCDate(dayStart.getUTCDate() + d);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const dateStr = dayStart.toISOString().slice(0, 10);
      const dayOfWeek = dayNames[dayStart.getUTCDay()];

      // Find schedules that overlap with this day
      const daySchedules: DutyScheduleEntry[] = schedules
        .filter(
          (s) =>
            s.startTime < dayEnd && s.endTime > dayStart,
        )
        .map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: s.user?.name ?? null,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        }));

      // Detect overlaps within this day
      for (let i = 0; i < daySchedules.length; i++) {
        for (let j = i + 1; j < daySchedules.length; j++) {
          const a = daySchedules[i];
          const b = daySchedules[j];

          const overlapStart = new Date(
            Math.max(a.startTime.getTime(), b.startTime.getTime()),
          );
          const overlapEnd = new Date(
            Math.min(a.endTime.getTime(), b.endTime.getTime()),
          );

          if (overlapStart < overlapEnd) {
            allOverlaps.push({
              date: dateStr,
              scheduleA: a.id,
              scheduleB: b.id,
              overlapStart,
              overlapEnd,
            });
          }
        }
      }

      // Check for gap: if no active schedule covers the off-hours period
      const activeSchedules = daySchedules.filter((s) => s.isActive);
      const hasGap = activeSchedules.length === 0;
      if (hasGap) totalGaps++;

      days.push({
        date: dateStr,
        dayOfWeek,
        schedules: daySchedules,
        hasGap,
      });
    }

    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      days,
      totalGaps,
      overlaps: allOverlaps,
    };
  }
}

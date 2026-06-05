import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '@org/prisma-client';
import { type Meeting, MeetingStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import {
  ACTIVE_MEETING_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  DEFAULT_DURATION,
  GENERATE_LINK_MAX_RETRIES,
  JOB_GENERATE_LINK,
  JOB_NO_SHOW_CHECK,
  JOB_NO_SHOW_WAIT_5MIN,
  JOB_REMINDER,
  MEETINGS_QUEUE,
  NO_SHOW_DELAY_MS,
  REMINDER_15MIN_MS,
  REMINDER_1H_MS,
  WAIT_DELAY_MS,
} from './meetings.const.js';
import {
  CancelMeetingDto,
  CreateMeetingDto,
  MeetingResponse,
} from './meetings.model.js';

/** Prisma include to join person name and case topic. */
const MEETING_ENRICH_INCLUDE = {
  person: { select: { name: true } },
  careCase: { select: { topic: true } },
} as const;

type MeetingWithRelations = Meeting & {
  person?: { name: string } | null;
  careCase?: { topic: string } | null;
};

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MEETINGS_QUEUE) private readonly meetingsQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateMeetingDto, consultantId: string): Promise<MeetingResponse> {
    const scheduledAt = new Date(dto.scheduledAt);

    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO 8601 date string');
    }

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const durationMin = dto.durationMin ?? DEFAULT_DURATION;

    // Lookup care case to get personId and verify consultant assignment
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: dto.careCaseId },
      select: { id: true, personId: true, consultantId: true },
    });

    if (!careCase) {
      throw new NotFoundException('Care case not found');
    }

    if (careCase.consultantId !== consultantId) {
      throw new BadRequestException('You are not assigned to this care case');
    }

    // Auto-fill timezones from user profiles
    const [consultant, person] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: consultantId },
        select: { timezone: true },
      }),
      this.prisma.user.findUnique({
        where: { id: careCase.personId },
        select: { timezone: true },
      }),
    ]);

    const consultantTz = consultant?.timezone ?? 'UTC';
    const personTz = person?.timezone ?? 'UTC';

    // Overlap check
    await this.checkOverlap(consultantId, scheduledAt, durationMin);

    const meeting = await this.prisma.meeting.create({
      data: {
        careCaseId: dto.careCaseId,
        consultantId,
        personId: careCase.personId,
        scheduledAt,
        durationMin,
        consultantTz,
        personTz,
        notes: dto.notes,
        status: MeetingStatus.SCHEDULED,
      },
      include: MEETING_ENRICH_INCLUDE,
    });

    this.logger.log(
      `Meeting ${meeting.id} created for case ${dto.careCaseId} at ${scheduledAt.toISOString()}`,
    );

    // Schedule Bull jobs for the new meeting
    await this.scheduleJobs(meeting);

    return this.formatWithTimezones(meeting);
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findByCaseId(caseId: string): Promise<MeetingResponse[]> {
    const meetings = await this.prisma.meeting.findMany({
      where: { careCaseId: caseId },
      orderBy: { scheduledAt: 'asc' },
      include: MEETING_ENRICH_INCLUDE,
    });

    return meetings.map((m) => this.formatWithTimezones(m));
  }

  async findByConsultant(
    consultantId: string,
    from?: string,
    to?: string,
  ): Promise<MeetingResponse[]> {
    const where: Record<string, unknown> = { consultantId };

    if (from || to) {
      const scheduledAtFilter: Record<string, Date> = {};
      if (from) scheduledAtFilter['gte'] = new Date(from);
      if (to) scheduledAtFilter['lte'] = new Date(to);
      where['scheduledAt'] = scheduledAtFilter;
    }

    const meetings = await this.prisma.meeting.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: MEETING_ENRICH_INCLUDE,
    });

    return meetings.map((m) => this.formatWithTimezones(m));
  }

  async findById(meetingId: string): Promise<MeetingResponse> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: MEETING_ENRICH_INCLUDE,
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return this.formatWithTimezones(meeting);
  }

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------

  async cancel(
    meetingId: string,
    dto: CancelMeetingDto,
    actorId: string,
  ): Promise<MeetingResponse> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true, consultantId: true },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.consultantId !== actorId) {
      throw new BadRequestException('Only the assigned consultant can cancel the meeting');
    }

    if (
      meeting.status === MeetingStatus.CANCELLED ||
      meeting.status === MeetingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot cancel a meeting with status ${meeting.status}`,
      );
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: MeetingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.cancelReason,
      },
      include: MEETING_ENRICH_INCLUDE,
    });

    this.logger.log(`Meeting ${meetingId} cancelled by ${actorId}`);

    return this.formatWithTimezones(updated);
  }

  // ---------------------------------------------------------------------------
  // Read — Person
  // ---------------------------------------------------------------------------

  async findByPerson(
    personId: string,
    from?: string,
    to?: string,
  ): Promise<MeetingResponse[]> {
    const where: Record<string, unknown> = { personId };

    if (from || to) {
      const scheduledAtFilter: Record<string, Date> = {};
      if (from) scheduledAtFilter['gte'] = new Date(from);
      if (to) scheduledAtFilter['lte'] = new Date(to);
      where['scheduledAt'] = scheduledAtFilter;
    }

    const meetings = await this.prisma.meeting.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: MEETING_ENRICH_INCLUDE,
    });

    return meetings.map((m) => this.formatWithTimezones(m));
  }

  // ---------------------------------------------------------------------------
  // Complete
  // ---------------------------------------------------------------------------

  async complete(meetingId: string, actorId: string): Promise<MeetingResponse> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true, consultantId: true },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.consultantId !== actorId) {
      throw new BadRequestException('Only the assigned consultant can complete the meeting');
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[meeting.status] ?? [];
    if (!allowed.includes(MeetingStatus.COMPLETED)) {
      throw new BadRequestException(
        `Cannot transition from ${meeting.status} to COMPLETED`,
      );
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.COMPLETED },
      include: MEETING_ENRICH_INCLUDE,
    });

    this.logger.log(`Meeting ${meetingId} completed by ${actorId}`);

    return this.formatWithTimezones(updated);
  }

  // ---------------------------------------------------------------------------
  // Update status (used by processor)
  // ---------------------------------------------------------------------------

  async updateStatus(meetingId: string, status: MeetingStatus): Promise<MeetingResponse> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[meeting.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${meeting.status} to ${status}`,
      );
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status },
      include: MEETING_ENRICH_INCLUDE,
    });

    this.logger.log(`Meeting ${meetingId} status updated to ${status}`);

    return this.formatWithTimezones(updated);
  }

  // ---------------------------------------------------------------------------
  // Job scheduling
  // ---------------------------------------------------------------------------

  private async scheduleJobs(meeting: Meeting): Promise<void> {
    const scheduledAt = meeting.scheduledAt.getTime();
    const now = Date.now();

    // 1. Generate meeting link immediately
    await this.meetingsQueue.add(
      JOB_GENERATE_LINK,
      { meetingId: meeting.id },
      {
        attempts: GENERATE_LINK_MAX_RETRIES,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: { count: 10 },
      },
    );

    // 2. Reminder 1 hour before (only if > 1h away)
    const delay1h = scheduledAt - REMINDER_1H_MS - now;
    if (delay1h > 0) {
      await this.meetingsQueue.add(
        JOB_REMINDER,
        {
          meetingId: meeting.id,
          reminderType: '1h',
          personId: meeting.personId,
          consultantId: meeting.consultantId,
        },
        { delay: delay1h, removeOnComplete: true },
      );
    }

    // 3. Reminder 15 min before (only if > 15min away)
    const delay15m = scheduledAt - REMINDER_15MIN_MS - now;
    if (delay15m > 0) {
      await this.meetingsQueue.add(
        JOB_REMINDER,
        {
          meetingId: meeting.id,
          reminderType: '15min',
          personId: meeting.personId,
          consultantId: meeting.consultantId,
        },
        { delay: delay15m, removeOnComplete: true },
      );
    }

    // 4. "We are waiting" nudge — 5 min after scheduledAt
    const delayWait = scheduledAt + WAIT_DELAY_MS - now;
    if (delayWait > 0) {
      await this.meetingsQueue.add(
        JOB_NO_SHOW_WAIT_5MIN,
        {
          meetingId: meeting.id,
          personId: meeting.personId,
        },
        { delay: delayWait, removeOnComplete: true },
      );
    }

    // 5. No-show check — 15 min after scheduledAt
    const delayNoShow = scheduledAt + NO_SHOW_DELAY_MS - now;
    if (delayNoShow > 0) {
      await this.meetingsQueue.add(
        JOB_NO_SHOW_CHECK,
        {
          meetingId: meeting.id,
          personId: meeting.personId,
          consultantId: meeting.consultantId,
        },
        { delay: delayNoShow, removeOnComplete: true },
      );
    }

    this.logger.log(`Scheduled Bull jobs for meeting ${meeting.id}`);
  }

  // ---------------------------------------------------------------------------
  // Overlap check
  // ---------------------------------------------------------------------------

  async checkOverlap(
    consultantId: string,
    scheduledAt: Date,
    durationMin: number,
    excludeMeetingId?: string,
  ): Promise<void> {
    const endTime = new Date(scheduledAt.getTime() + durationMin * 60_000);

    // Fetch meetings that start before the new meeting ends (first half of overlap check).
    // The second half (existing end > new start) is computed in-memory because
    // Prisma cannot filter on a derived column (scheduledAt + durationMin).
    const overlapping = await this.prisma.meeting.findMany({
      where: {
        consultantId,
        status: { in: ACTIVE_MEETING_STATUSES },
        scheduledAt: { lt: endTime },
        ...(excludeMeetingId ? { id: { not: excludeMeetingId } } : {}),
      },
    });

    // Filter in-memory for meetings whose end time > new meeting's start time
    const conflicts = overlapping.filter((m) => {
      const existingEnd = new Date(m.scheduledAt.getTime() + m.durationMin * 60_000);
      return existingEnd > scheduledAt;
    });

    if (conflicts.length > 0) {
      throw new ConflictException(
        'The requested time slot overlaps with an existing meeting',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Timezone formatting
  // ---------------------------------------------------------------------------

  formatWithTimezones(meeting: MeetingWithRelations): MeetingResponse {
    const personTzTime = this.formatInTimezone(meeting.scheduledAt, meeting.personTz);
    const consultantTzTime = this.formatInTimezone(meeting.scheduledAt, meeting.consultantTz);

    const personName = meeting.person?.name ?? null;

    return {
      id: meeting.id,
      careCaseId: meeting.careCaseId,
      consultantId: meeting.consultantId,
      personId: meeting.personId,
      status: meeting.status,
      scheduledAt: meeting.scheduledAt,
      durationMin: meeting.durationMin,
      personTz: meeting.personTz,
      consultantTz: meeting.consultantTz,
      meetingUrl: meeting.meetingUrl,
      notes: meeting.notes,
      cancelledAt: meeting.cancelledAt,
      cancelReason: meeting.cancelReason,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      personTzTime,
      consultantTzTime,
      personName,
      topic: meeting.careCase?.topic ?? null,
    };
  }

  private formatInTimezone(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    } catch {
      // Fallback to UTC if invalid timezone
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    }
  }
}

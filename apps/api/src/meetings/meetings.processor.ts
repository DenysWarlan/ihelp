import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { MeetingStatus } from '@prisma/client';
import { Job } from 'bullmq';

import {
  JOB_GENERATE_LINK,
  JOB_NO_SHOW_CHECK,
  JOB_NO_SHOW_WAIT_5MIN,
  JOB_REMINDER,
  MEETINGS_QUEUE,
  NO_SHOW_ELIGIBLE_STATUSES,
} from './meetings.const.js';
import { GoogleMeetService } from './google-meet.service.js';

// ---------------------------------------------------------------------------
// Job payload interfaces
// ---------------------------------------------------------------------------

interface GenerateLinkPayload {
  readonly meetingId: string;
}

interface ReminderPayload {
  readonly meetingId: string;
  readonly reminderType: '1h' | '15min';
  readonly personId: string;
  readonly consultantId: string;
}

interface NoShowCheckPayload {
  readonly meetingId: string;
  readonly personId: string;
  readonly consultantId: string;
}

interface NoShowWait5MinPayload {
  readonly meetingId: string;
  readonly personId: string;
}

type MeetingJobPayload =
  | GenerateLinkPayload
  | ReminderPayload
  | NoShowCheckPayload
  | NoShowWait5MinPayload;

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

@Processor(MEETINGS_QUEUE)
export class MeetingsProcessor extends WorkerHost {
  private readonly logger = new Logger(MeetingsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMeet: GoogleMeetService,
  ) {
    super();
  }

  async process(job: Job<MeetingJobPayload>): Promise<void> {
    switch (job.name) {
      case JOB_GENERATE_LINK:
        await this.handleGenerateLink(job as Job<GenerateLinkPayload>);
        break;
      case JOB_REMINDER:
        await this.handleReminder(job as Job<ReminderPayload>);
        break;
      case JOB_NO_SHOW_CHECK:
        await this.handleNoShowCheck(job as Job<NoShowCheckPayload>);
        break;
      case JOB_NO_SHOW_WAIT_5MIN:
        await this.handleNoShowWait5Min(job as Job<NoShowWait5MinPayload>);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // GENERATE_LINK — MVP: placeholder URL
  // ---------------------------------------------------------------------------

  private async handleGenerateLink(job: Job<GenerateLinkPayload>): Promise<void> {
    const { meetingId } = job.data;

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        meetingUrl: true,
        scheduledAt: true,
        durationMin: true,
        careCase: { select: { topic: true } },
        person: { select: { name: true } },
      },
    });

    if (!meeting) {
      this.logger.warn(`Meeting ${meetingId} not found — skipping link generation`);
      return;
    }

    if (meeting.meetingUrl) {
      this.logger.debug(`Meeting ${meetingId} already has a URL — skipping`);
      return;
    }

    const personName = meeting.person?.name ?? 'Client';
    const title = `${meeting.careCase?.topic ?? 'Meeting'} — ${personName}`;

    const meetingUrl = await this.googleMeet.createMeetLink({
      meetingId,
      title,
      scheduledAt: meeting.scheduledAt,
      durationMin: meeting.durationMin,
    });

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { meetingUrl },
    });

    this.logger.log(`Generated meeting link for ${meetingId}: ${meetingUrl}`);
  }

  // ---------------------------------------------------------------------------
  // REMINDER — MVP: log-based
  // ---------------------------------------------------------------------------

  private async handleReminder(job: Job<ReminderPayload>): Promise<void> {
    const { meetingId, reminderType, personId, consultantId } = job.data;

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        meetingUrl: true,
        personTz: true,
        consultantTz: true,
      },
    });

    if (!meeting) {
      this.logger.warn(`Meeting ${meetingId} not found — skipping reminder`);
      return;
    }

    // Skip reminders for cancelled/completed meetings
    if (
      meeting.status === MeetingStatus.CANCELLED ||
      meeting.status === MeetingStatus.COMPLETED
    ) {
      this.logger.debug(
        `Meeting ${meetingId} is ${meeting.status} — skipping ${reminderType} reminder`,
      );
      return;
    }

    const personTime = this.formatInTimezone(meeting.scheduledAt, meeting.personTz);
    const consultantTime = this.formatInTimezone(meeting.scheduledAt, meeting.consultantTz);

    // MVP: log instead of sending notifications
    this.logger.log(
      `[REMINDER ${reminderType}] Meeting ${meetingId} ` +
        `| Person (${personId}): ${personTime} (${meeting.personTz}) ` +
        `| Consultant (${consultantId}): ${consultantTime} (${meeting.consultantTz}) ` +
        `| Link: ${meeting.meetingUrl ?? 'pending'}`,
    );
  }

  // ---------------------------------------------------------------------------
  // NO_SHOW_WAIT_5MIN — "we are waiting" nudge
  // ---------------------------------------------------------------------------

  private async handleNoShowWait5Min(job: Job<NoShowWait5MinPayload>): Promise<void> {
    const { meetingId, personId } = job.data;

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true },
    });

    if (!meeting) {
      this.logger.warn(`Meeting ${meetingId} not found — skipping 5min nudge`);
      return;
    }

    // Only nudge if still in a "waiting" state
    if (!NO_SHOW_ELIGIBLE_STATUSES.includes(meeting.status)) {
      this.logger.debug(
        `Meeting ${meetingId} is ${meeting.status} — skipping 5min nudge`,
      );
      return;
    }

    // MVP: log the message instead of actually sending it
    this.logger.log(
      `[NO_SHOW_WAIT_5MIN] Meeting ${meetingId} ` +
        `| Sending to Person (${personId}): "Ми чекаємо на вас"`,
    );
  }

  // ---------------------------------------------------------------------------
  // NO_SHOW_CHECK — 15 min auto no-show
  // ---------------------------------------------------------------------------

  private async handleNoShowCheck(job: Job<NoShowCheckPayload>): Promise<void> {
    const { meetingId, personId, consultantId } = job.data;

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true },
    });

    if (!meeting) {
      this.logger.warn(`Meeting ${meetingId} not found — skipping no-show check`);
      return;
    }

    // Only transition if still in an eligible state
    if (!NO_SHOW_ELIGIBLE_STATUSES.includes(meeting.status)) {
      this.logger.debug(
        `Meeting ${meetingId} is ${meeting.status} — skipping no-show check`,
      );
      return;
    }

    // MVP: assume person no-show (no real activity tracking yet)
    // In production, check if person joined the meeting vs consultant
    const newStatus = MeetingStatus.NO_SHOW_PERSON;

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: newStatus },
    });

    this.logger.log(
      `[NO_SHOW_CHECK] Meeting ${meetingId} → ${newStatus} ` +
        `| Person: ${personId}, Consultant: ${consultantId}`,
    );

    // MVP: log suggestion to consultant
    this.logger.log(
      `[NO_SHOW_SUGGESTION] Consultant (${consultantId}): ` +
        `"Рекомендуємо написати клієнту в чат"`,
    );
  }

  // ---------------------------------------------------------------------------
  // Worker events
  // ---------------------------------------------------------------------------

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Job ${job.name} (${job.id}) failed on attempt ${job.attemptsMade}: ${error.message}`,
    );

    // If GENERATE_LINK exhausted all retries, log for manual action
    if (job.name === JOB_GENERATE_LINK && job.attemptsMade >= job.opts.attempts!) {
      const { meetingId } = job.data as GenerateLinkPayload;
      this.logger.warn(
        `[MANUAL_ACTION_REQUIRED] Failed to generate link for meeting ${meetingId} ` +
          `after ${job.attemptsMade} attempts. Consultant must create link manually.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatInTimezone(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('uk-UA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat('uk-UA', {
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

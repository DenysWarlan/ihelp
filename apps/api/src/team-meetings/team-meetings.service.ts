import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import {
  Role,
  TeamMeetingStatus,
  TeamParticipantStatus,
} from '@prisma/client';

import {
  DEFAULT_TEAM_MEETING_DURATION,
  STAFF_ROLES,
  TEAM_MEETING_LINK_BASE_URL,
} from './team-meetings.const.js';
import {
  CancelTeamMeetingDto,
  CreateTeamMeetingDto,
  StaffUserResponse,
  TeamMeetingResponse,
} from './team-meetings.model.js';

/** Prisma include to join organizer + participant user details. */
const TEAM_MEETING_INCLUDE = {
  organizer: { select: { name: true } },
  participants: {
    include: { user: { select: { name: true, role: true } } },
  },
} as const;

@Injectable()
export class TeamMeetingsService {
  private readonly logger = new Logger(TeamMeetingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateTeamMeetingDto,
    organizerId: string,
  ): Promise<TeamMeetingResponse> {
    const scheduledAt = new Date(dto.scheduledAt);

    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO 8601 date string');
    }

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    // De-duplicate and drop the organizer from the invite list.
    const participantIds = [...new Set(dto.participantIds)].filter(
      (id) => id !== organizerId,
    );

    if (participantIds.length === 0) {
      throw new BadRequestException('At least one other staff participant is required');
    }

    // All invitees must be active staff users.
    const validParticipants = await this.prisma.user.findMany({
      where: {
        id: { in: participantIds },
        isActive: true,
        role: { in: STAFF_ROLES as unknown as Role[] },
      },
      select: { id: true },
    });

    if (validParticipants.length !== participantIds.length) {
      throw new BadRequestException(
        'One or more participants are not valid active staff users',
      );
    }

    const meeting = await this.prisma.teamMeeting.create({
      data: {
        organizerId,
        title: dto.title,
        scheduledAt,
        durationMin: dto.durationMin ?? DEFAULT_TEAM_MEETING_DURATION,
        notes: dto.notes,
        status: TeamMeetingStatus.SCHEDULED,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            status: TeamParticipantStatus.INVITED,
          })),
        },
      },
      include: TEAM_MEETING_INCLUDE,
    });

    // Generate a stable video link for the meeting room.
    const updated = await this.prisma.teamMeeting.update({
      where: { id: meeting.id },
      data: { meetingUrl: `${TEAM_MEETING_LINK_BASE_URL}/ihelp-team-${meeting.id}` },
      include: TEAM_MEETING_INCLUDE,
    });

    this.logger.log(
      `Team meeting ${meeting.id} created by ${organizerId} with ${participantIds.length} participant(s)`,
    );

    return this.formatMeeting(updated, organizerId);
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findMine(userId: string): Promise<TeamMeetingResponse[]> {
    const meetings = await this.prisma.teamMeeting.findMany({
      where: {
        OR: [
          { organizerId: userId },
          { participants: { some: { userId } } },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
      include: TEAM_MEETING_INCLUDE,
    });

    return meetings.map((m) => this.formatMeeting(m, userId));
  }

  async listStaff(excludeUserId: string): Promise<StaffUserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: STAFF_ROLES as unknown as Role[] },
        id: { not: excludeUserId },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true },
    });

    return users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
  }

  // ---------------------------------------------------------------------------
  // Respond (participant accepts / declines)
  // ---------------------------------------------------------------------------

  async respond(
    meetingId: string,
    userId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ): Promise<TeamMeetingResponse> {
    const meeting = await this.prisma.teamMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true },
    });

    if (!meeting) {
      throw new NotFoundException('Team meeting not found');
    }

    if (meeting.status !== TeamMeetingStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot respond to a meeting with status ${meeting.status}`,
      );
    }

    const participant = await this.prisma.teamMeetingParticipant.findUnique({
      where: { teamMeetingId_userId: { teamMeetingId: meetingId, userId } },
      select: { id: true },
    });

    if (!participant) {
      throw new ForbiddenException('You are not invited to this meeting');
    }

    await this.prisma.teamMeetingParticipant.update({
      where: { id: participant.id },
      data: { status: status as TeamParticipantStatus },
    });

    this.logger.log(`Team meeting ${meetingId} ${status} by ${userId}`);

    return this.findOne(meetingId, userId);
  }

  // ---------------------------------------------------------------------------
  // Cancel / Complete (organizer only)
  // ---------------------------------------------------------------------------

  async cancel(
    meetingId: string,
    userId: string,
    dto: CancelTeamMeetingDto,
  ): Promise<TeamMeetingResponse> {
    const meeting = await this.requireOrganizer(meetingId, userId);

    if (meeting.status !== TeamMeetingStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot cancel a meeting with status ${meeting.status}`,
      );
    }

    await this.prisma.teamMeeting.update({
      where: { id: meetingId },
      data: {
        status: TeamMeetingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.cancelReason,
      },
    });

    this.logger.log(`Team meeting ${meetingId} cancelled by ${userId}`);

    return this.findOne(meetingId, userId);
  }

  async complete(meetingId: string, userId: string): Promise<TeamMeetingResponse> {
    const meeting = await this.requireOrganizer(meetingId, userId);

    if (meeting.status !== TeamMeetingStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot complete a meeting with status ${meeting.status}`,
      );
    }

    await this.prisma.teamMeeting.update({
      where: { id: meetingId },
      data: { status: TeamMeetingStatus.COMPLETED },
    });

    this.logger.log(`Team meeting ${meetingId} completed by ${userId}`);

    return this.findOne(meetingId, userId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOne(
    meetingId: string,
    userId: string,
  ): Promise<TeamMeetingResponse> {
    const meeting = await this.prisma.teamMeeting.findUnique({
      where: { id: meetingId },
      include: TEAM_MEETING_INCLUDE,
    });

    if (!meeting) {
      throw new NotFoundException('Team meeting not found');
    }

    return this.formatMeeting(meeting, userId);
  }

  private async requireOrganizer(
    meetingId: string,
    userId: string,
  ): Promise<{ id: string; status: TeamMeetingStatus; organizerId: string }> {
    const meeting = await this.prisma.teamMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true, organizerId: true },
    });

    if (!meeting) {
      throw new NotFoundException('Team meeting not found');
    }

    if (meeting.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can perform this action');
    }

    return meeting;
  }

  private formatMeeting(
    meeting: {
      id: string;
      organizerId: string;
      organizer: { name: string };
      title: string;
      scheduledAt: Date;
      durationMin: number;
      meetingUrl: string | null;
      notes: string | null;
      status: TeamMeetingStatus;
      cancelledAt: Date | null;
      cancelReason: string | null;
      createdAt: Date;
      participants: {
        id: string;
        userId: string;
        status: TeamParticipantStatus;
        user: { name: string; role: Role };
      }[];
    },
    requestingUserId: string,
  ): TeamMeetingResponse {
    const me = meeting.participants.find((p) => p.userId === requestingUserId);

    return {
      id: meeting.id,
      organizerId: meeting.organizerId,
      organizerName: meeting.organizer.name,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      durationMin: meeting.durationMin,
      meetingUrl: meeting.meetingUrl,
      notes: meeting.notes,
      status: meeting.status,
      cancelledAt: meeting.cancelledAt,
      cancelReason: meeting.cancelReason,
      createdAt: meeting.createdAt,
      participants: meeting.participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        role: p.user.role,
        status: p.status,
      })),
      isOrganizer: meeting.organizerId === requestingUserId,
      myStatus: me ? me.status : null,
    };
  }
}

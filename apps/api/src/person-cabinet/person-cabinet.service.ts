import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, MeetingStatus, EnrollmentStatus } from '@prisma/client';

import {
  DashboardCareCaseDto,
  DashboardCourseDto,
  DashboardMeetingDto,
  PersonDashboardResponse,
} from './person-cabinet.model.js';

const CHAT_ELIGIBLE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED,
  CaseStatus.IN_PROGRESS,
  CaseStatus.MEETING_SCHEDULED,
  CaseStatus.ON_HOLD,
  CaseStatus.TRANSFERRED,
];

const UPCOMING_MEETING_STATUSES: MeetingStatus[] = [
  MeetingStatus.SCHEDULED,
  MeetingStatus.CONFIRMED,
];

@Injectable()
export class PersonCabinetService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(personId: string): Promise<PersonDashboardResponse> {
    const [careCase, nextMeeting, courses] = await Promise.all([
      this.getActiveCase(personId),
      this.getNextMeeting(personId),
      this.getEnrolledCourses(personId),
    ]);

    const canChat =
      careCase !== null &&
      CHAT_ELIGIBLE_STATUSES.includes(careCase.status as CaseStatus);

    return {
      careCase: careCase
        ? {
            id: careCase.id,
            status: careCase.status,
            consultantName: careCase.consultant?.name ?? null,
            consultantAvatarUrl: careCase.consultant?.avatarUrl ?? null,
            topic: careCase.topic,
          }
        : null,
      canChat,
      nextMeeting: nextMeeting
        ? {
            id: nextMeeting.id,
            scheduledAt: nextMeeting.scheduledAt,
            durationMin: nextMeeting.durationMin,
            meetingUrl: nextMeeting.meetingUrl,
            consultantName: nextMeeting.consultant.name,
          }
        : null,
      courses,
    };
  }

  private async getActiveCase(personId: string) {
    return this.prisma.careCase.findFirst({
      where: {
        personId,
        status: {
          notIn: [CaseStatus.COMPLETED, CaseStatus.CLOSED],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        topic: true,
        consultant: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  private async getNextMeeting(personId: string) {
    return this.prisma.meeting.findFirst({
      where: {
        personId,
        status: { in: UPCOMING_MEETING_STATUSES },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        meetingUrl: true,
        consultant: {
          select: { name: true },
        },
      },
    });
  }

  private async getEnrolledCourses(
    personId: string,
  ): Promise<DashboardCourseDto[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        personId,
        status: EnrollmentStatus.ACTIVE,
      },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            lessonCount: true,
          },
        },
      },
    });

    if (enrollments.length === 0) {
      return [];
    }

    const courseIds = enrollments.map((e) => e.course.id);

    const completedCounts = await this.prisma.lessonProgress.groupBy({
      by: ['courseId'],
      where: {
        personId,
        courseId: { in: courseIds },
        isCompleted: true,
      },
      _count: { id: true },
    });

    const completedMap = new Map(
      completedCounts.map((c) => [c.courseId, c._count.id]),
    );

    return enrollments.map((e) => {
      const totalLessons = e.course.lessonCount;
      const completedLessons = completedMap.get(e.course.id) ?? 0;
      const progressPercent =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      return {
        id: e.course.id,
        title: e.course.title,
        imageUrl: e.course.imageUrl,
        totalLessons,
        completedLessons,
        progressPercent,
      };
    });
  }
}

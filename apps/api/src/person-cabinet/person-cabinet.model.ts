export interface DashboardCareCaseDto {
  readonly id: string;
  readonly status: string;
  readonly consultantName: string | null;
  readonly consultantAvatarUrl: string | null;
  readonly topic: string;
}

export interface DashboardMeetingDto {
  readonly id: string;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly consultantName: string;
}

export interface DashboardCourseDto {
  readonly id: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly totalLessons: number;
  readonly completedLessons: number;
  readonly progressPercent: number;
}

export interface PersonDashboardResponse {
  readonly careCase: DashboardCareCaseDto | null;
  readonly canChat: boolean;
  readonly nextMeeting: DashboardMeetingDto | null;
  readonly courses: DashboardCourseDto[];
}

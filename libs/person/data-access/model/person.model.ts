export interface PersonDashboard {
  readonly activeCases: number;
  readonly upcomingMeetings: number;
  readonly courseProgress: number;
  readonly unreadMessages: number;
  readonly recentActivity: PersonActivity[];
}

export interface PersonActivity {
  readonly id: string;
  readonly type:
    | 'case_update'
    | 'meeting_scheduled'
    | 'course_progress'
    | 'message';
  readonly title: string;
  readonly description: string;
  readonly timestamp: string;
}

export interface PersonCourse {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly progress: number;
  readonly totalLessons: number;
  readonly completedLessons: number;
  readonly status: 'not_started' | 'in_progress' | 'completed';
  readonly thumbnailUrl: string | null;
}

export interface PersonCourseDetail {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly progress: number;
  readonly lessons: PersonLesson[];
}

export interface PersonLesson {
  readonly id: string;
  readonly title: string;
  readonly orderIndex: number;
  readonly isCompleted: boolean;
  readonly contentType: string;
}

export interface PersonMeeting {
  readonly id: string;
  readonly title: string;
  readonly scheduledAt: string;
  readonly durationMinutes: number;
  readonly status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  readonly consultantName: string;
  readonly meetingUrl: string | null;
}

export interface PersonProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly timezone: string;
}

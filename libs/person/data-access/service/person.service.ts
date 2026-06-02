import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonLessonDetail,
  PersonMeeting,
  PersonProfile,
  SetPasswordRequest,
} from '../model/person.model';

interface BackendCourseDto {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly lessonCount: number;
  readonly completedCount: number;
  readonly progressPercent: number;
  readonly enrollmentStatus: string;
}

interface BackendCoursesResponse {
  readonly active: BackendCourseDto[];
  readonly recommended: BackendCourseDto[];
}

interface BackendDashboardResponse {
  readonly careCase: {
    readonly id: string;
    readonly status: string;
    readonly consultantName: string | null;
    readonly consultantAvatarUrl: string | null;
    readonly topic: string;
  } | null;
  readonly canChat: boolean;
  readonly nextMeeting: {
    readonly id: string;
    readonly scheduledAt: string;
    readonly durationMin: number;
    readonly meetingUrl: string | null;
    readonly consultantName: string;
  } | null;
  readonly courses: readonly {
    readonly id: string;
    readonly title: string;
    readonly totalLessons: number;
    readonly completedLessons: number;
    readonly progressPercent: number;
  }[];
}

interface BackendMeetingDto {
  readonly id: string;
  readonly careCaseId: string;
  readonly scheduledAt: string;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly status: string;
  readonly personTz: string;
  readonly personTzTime: string;
  readonly consultantName: string;
}

@Injectable({ providedIn: 'root' })
export class PersonService {
  private readonly http: HttpClient = inject(HttpClient);

  getDashboard(): Observable<PersonDashboard> {
    return this.http.get<BackendDashboardResponse>('/api/person-cabinet/dashboard').pipe(
      map((res) => ({
        activeCases: res.careCase ? 1 : 0,
        upcomingMeetings: res.nextMeeting ? 1 : 0,
        courseProgress: res.courses.length,
        unreadMessages: 0,
        recentActivity: [],
        consultantName: res.careCase?.consultantName ?? null,
        consultantSpecialty: null,
        caseStatus: res.careCase?.status ?? null,
        caseTopic: res.careCase?.topic ?? null,
      })),
    );
  }

  getCourses(): Observable<PersonCourse[]> {
    return this.http.get<BackendCoursesResponse>('/api/person-cabinet/courses').pipe(
      map((res) => [
        ...res.active.map((c) => this.mapCourse(c, 'in_progress')),
        ...res.recommended.map((c) => this.mapCourse(c, 'not_started')),
      ]),
    );
  }

  private mapCourse(
    c: BackendCourseDto,
    status: PersonCourse['status'],
  ): PersonCourse {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      progress: c.progressPercent,
      totalLessons: c.lessonCount,
      completedLessons: c.completedCount,
      status,
      thumbnailUrl: c.imageUrl,
    };
  }

  getCourseDetail(id: string): Observable<PersonCourseDetail> {
    return this.http.get<PersonCourseDetail>(
      `/api/person-cabinet/courses/${id}`,
    );
  }

  getLessonDetail(courseId: string, lessonId: string): Observable<PersonLessonDetail> {
    return this.http.get<PersonLessonDetail>(
      `/api/person-cabinet/courses/${courseId}/lessons/${lessonId}`,
    );
  }

  completeLesson(courseId: string, lessonId: string): Observable<void> {
    return this.http.post<void>(
      `/api/person-cabinet/courses/${courseId}/lessons/${lessonId}/complete`,
      {},
    );
  }

  enrollInCourse(courseId: string): Observable<void> {
    return this.http.post<void>(`/api/courses/${courseId}/enroll`, {});
  }

  getMeetings(): Observable<PersonMeeting[]> {
    return this.http.get<BackendMeetingDto[]>('/api/person-cabinet/meetings').pipe(
      map((meetings) =>
        meetings.map((m) => ({
          id: m.id,
          title: `Meeting · ${m.consultantName}`,
          scheduledAt: m.scheduledAt,
          durationMinutes: m.durationMin,
          status: m.status as PersonMeeting['status'],
          consultantName: m.consultantName,
          meetingUrl: m.meetingUrl,
        })),
      ),
    );
  }

  getProfile(): Observable<PersonProfile> {
    return this.http.get<PersonProfile>('/api/person-cabinet/profile');
  }

  updateProfile(data: Partial<PersonProfile>): Observable<PersonProfile> {
    return this.http.patch<PersonProfile>('/api/person-cabinet/profile', data);
  }

  setPassword(password: string, currentPassword?: string): Observable<void> {
    const body: SetPasswordRequest = { password, ...(currentPassword ? { currentPassword } : {}) };
    return this.http.post<void>('/api/auth/set-password', body);
  }
}

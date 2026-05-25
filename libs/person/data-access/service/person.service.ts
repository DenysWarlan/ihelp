import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonMeeting,
  PersonProfile,
} from '../model/person.model';

@Injectable({ providedIn: 'root' })
export class PersonService {
  private readonly http: HttpClient = inject(HttpClient);

  getDashboard(): Observable<PersonDashboard> {
    return this.http.get<PersonDashboard>('/api/person-cabinet/dashboard');
  }

  getCourses(): Observable<PersonCourse[]> {
    return this.http.get<PersonCourse[]>('/api/person-cabinet/courses');
  }

  getCourseDetail(id: string): Observable<PersonCourseDetail> {
    return this.http.get<PersonCourseDetail>(
      `/api/person-cabinet/courses/${id}`,
    );
  }

  completeLesson(courseId: string, lessonId: string): Observable<void> {
    return this.http.post<void>(
      `/api/person-cabinet/courses/${courseId}/lessons/${lessonId}/complete`,
      {},
    );
  }

  getMeetings(): Observable<PersonMeeting[]> {
    return this.http.get<PersonMeeting[]>('/api/person-cabinet/meetings');
  }

  getProfile(): Observable<PersonProfile> {
    return this.http.get<PersonProfile>('/api/person-cabinet/profile');
  }

  updateProfile(data: Partial<PersonProfile>): Observable<PersonProfile> {
    return this.http.patch<PersonProfile>('/api/person-cabinet/profile', data);
  }
}

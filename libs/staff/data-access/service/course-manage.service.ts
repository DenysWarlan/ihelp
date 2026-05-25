import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AdminCourse, CreateCourseFormModel } from '../model/course-manage.model';

@Injectable({ providedIn: 'root' })
export class CourseManageService {
  private readonly http: HttpClient = inject(HttpClient);

  getCourses(
    params?: Record<string, string>
  ): Observable<{ data: AdminCourse[]; total: number }> {
    return this.http.get<{ data: AdminCourse[]; total: number }>(
      '/api/admin/courses',
      { params }
    );
  }

  createCourse(dto: CreateCourseFormModel): Observable<AdminCourse> {
    return this.http.post<AdminCourse>('/api/admin/courses', dto);
  }

  deleteCourse(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/courses/${id}`);
  }

  changeStatus(
    id: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  ): Observable<AdminCourse> {
    return this.http.post<AdminCourse>(`/api/admin/courses/${id}/status`, {
      status,
    });
  }
}

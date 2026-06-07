import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AdminCourse,
  AdminCourseDetail,
  AdminLesson,
  CourseStatus,
  CreateCourseFormModel,
} from '../model/course-manage.model';

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

  getStaffCourses(): Observable<AdminCourse[]> {
    return this.http.get<AdminCourse[]>('/api/courses/staff');
  }

  getCourseDetail(id: string): Observable<AdminCourseDetail> {
    return this.http.get<AdminCourseDetail>(`/api/admin/courses/${id}`);
  }

  createCourse(dto: CreateCourseFormModel): Observable<AdminCourse> {
    return this.http.post<AdminCourse>('/api/admin/courses', dto);
  }

  updateCourse(
    id: string,
    dto: Partial<{ title: string; description: string; visibility: string }>
  ): Observable<AdminCourseDetail> {
    return this.http.patch<AdminCourseDetail>(`/api/admin/courses/${id}`, dto);
  }

  deleteCourse(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/courses/${id}`);
  }

  changeStatus(id: string, status: CourseStatus): Observable<AdminCourse> {
    return this.http.post<AdminCourse>(`/api/admin/courses/${id}/status`, {
      status,
    });
  }

  createLesson(
    courseId: string,
    dto: {
      title: string;
      content: string;
      contentType: string;
      videoUrl?: string;
      imageUrl?: string;
    }
  ): Observable<AdminLesson> {
    return this.http.post<AdminLesson>(
      `/api/admin/courses/${courseId}/lessons`,
      dto
    );
  }

  updateLesson(
    courseId: string,
    lessonId: string,
    dto: Partial<{
      title: string;
      content: string;
      contentType: string;
      videoUrl: string | null;
      imageUrl: string | null;
    }>
  ): Observable<AdminLesson> {
    return this.http.patch<AdminLesson>(
      `/api/admin/courses/${courseId}/lessons/${lessonId}`,
      dto
    );
  }

  deleteLesson(courseId: string, lessonId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/admin/courses/${courseId}/lessons/${lessonId}`
    );
  }

  uploadFile(formData: unknown): Observable<{ key: string; url: string }> {
    return this.http.post<{ key: string; url: string }>(
      '/api/storage/upload',
      formData
    );
  }

  deleteFile(key: string): Observable<void> {
    return this.http.delete<void>(`/api/storage/${key}`);
  }
}

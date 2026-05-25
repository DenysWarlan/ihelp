import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CourseDetail, CourseListItem } from '../model/course.model';

@Injectable({ providedIn: 'root' })
export class CoursesService {
  private readonly http: HttpClient = inject(HttpClient);

  getAll(): Observable<CourseListItem[]> {
    return this.http.get<CourseListItem[]>('/api/courses');
  }

  getById(id: string): Observable<CourseDetail> {
    return this.http.get<CourseDetail>(`/api/courses/${id}`);
  }
}

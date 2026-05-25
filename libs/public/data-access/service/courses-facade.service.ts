import { inject, Injectable, Signal } from '@angular/core';
import { Router } from '@angular/router';

import { CourseDetail, CourseListItem } from '../model/course.model';
import { CoursesStore } from '../store/courses.store';

@Injectable({ providedIn: 'root' })
export class CoursesFacade {
  private readonly store = inject(CoursesStore);
  private readonly router: Router = inject(Router);

  readonly courses: Signal<CourseListItem[]> = this.store.courses;
  readonly selectedCourse: Signal<CourseDetail | null> =
    this.store.selectedCourse;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  loadCourses(): void {
    this.store.loadCourses();
  }

  loadCourse(id: string): void {
    this.store.loadCourse(id);
  }

  navigateToPreview(id: string): void {
    this.router.navigate(['/catalog', id]);
  }
}

import { inject, Injectable, Signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonMeeting,
  PersonProfile,
} from '../model/person.model';
import { PersonStore } from '../store/person.store';

@Injectable({ providedIn: 'root' })
export class PersonFacade {
  private readonly store = inject(PersonStore);
  private readonly router: Router = inject(Router);

  readonly dashboard: Signal<PersonDashboard | null> = this.store.dashboard;
  readonly courses: Signal<PersonCourse[]> = this.store.courses;
  readonly selectedCourse: Signal<PersonCourseDetail | null> =
    this.store.selectedCourse;
  readonly meetings: Signal<PersonMeeting[]> = this.store.meetings;
  readonly profile: Signal<PersonProfile | null> = this.store.profile;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly isSaving: Signal<boolean> = this.store.isSaving;
  readonly error: Signal<string | null> = this.store.error;

  loadDashboard(): void {
    this.store.loadDashboard();
  }

  loadCourses(): void {
    this.store.loadCourses();
  }

  loadCourseDetail(id: string): void {
    this.store.loadCourseDetail(id);
  }

  loadMeetings(): void {
    this.store.loadMeetings();
  }

  loadProfile(): void {
    this.store.loadProfile();
  }

  updateProfile(data: Partial<PersonProfile>): void {
    this.store.updateProfile(data);
  }

  completeLesson(courseId: string, lessonId: string): void {
    this.store.completeLesson({ courseId, lessonId });
  }

  navigateToCourse(id: string): void {
    this.router.navigate(['/person/courses', id]);
  }

  navigateToCourses(): void {
    this.router.navigate(['/person/courses']);
  }
}

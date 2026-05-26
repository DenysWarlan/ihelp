import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonLessonDetail,
  PersonMeeting,
  PersonProfile,
} from '../model/person.model';
import { PersonStore } from '../store/person.store';

interface PasswordFormModel {
  readonly newPassword: string;
  readonly currentPassword: string;
}

@Injectable({ providedIn: 'root' })
export class PersonFacade {
  private readonly store = inject(PersonStore);
  private readonly router: Router = inject(Router);

  readonly dashboard: Signal<PersonDashboard | null> = this.store.dashboard;
  readonly courses: Signal<PersonCourse[]> = this.store.courses;
  readonly selectedCourse: Signal<PersonCourseDetail | null> =
    this.store.selectedCourse;
  readonly selectedLesson: Signal<PersonLessonDetail | null> =
    this.store.selectedLesson;
  readonly meetings: Signal<PersonMeeting[]> = this.store.meetings;
  readonly profile: Signal<PersonProfile | null> = this.store.profile;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly isSaving: Signal<boolean> = this.store.isSaving;
  readonly isSettingPassword: Signal<boolean> = this.store.isSettingPassword;
  readonly passwordSuccess: Signal<boolean> = this.store.passwordSuccess;
  readonly error: Signal<string | null> = this.store.error;
  readonly hasPassword: Signal<boolean> = computed(() => this.store.profile()?.hasPassword ?? false);

  readonly passwordModel: WritableSignal<PasswordFormModel> = signal({
    newPassword: '',
    currentPassword: '',
  });

  loadDashboard(): void {
    this.store.loadDashboard();
  }

  loadCourses(): void {
    this.store.loadCourses();
  }

  loadCourseDetail(id: string): void {
    this.store.loadCourseDetail(id);
  }

  loadLessonDetail(courseId: string, lessonId: string): void {
    this.store.loadLessonDetail({ courseId, lessonId });
  }

  navigateToLesson(courseId: string, lessonId: string): void {
    this.router.navigate(['/person/courses', courseId, 'lessons', lessonId]);
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

  updatePasswordField(field: keyof PasswordFormModel, value: string): void {
    this.passwordModel.update((current: PasswordFormModel) => ({
      ...current,
      [field]: value,
    }));
  }

  setPassword(): void {
    const form = this.passwordModel();
    const hasExistingPassword = this.hasPassword();
    this.store.setPassword({
      password: form.newPassword,
      ...(hasExistingPassword ? { currentPassword: form.currentPassword } : {}),
    });
    this.passwordModel.set({ newPassword: '', currentPassword: '' });
  }

  completeLesson(courseId: string, lessonId: string): void {
    this.store.completeLesson({ courseId, lessonId });
  }

  enrollInCourse(id: string): void {
    this.store.enrollInCourse(id);
  }

  navigateToCourse(id: string): void {
    this.router.navigate(['/person/courses', id]);
  }

  navigateToCourses(): void {
    this.router.navigate(['/person/courses']);
  }
}

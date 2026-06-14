import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonLesson,
  PersonLessonDetail,
  PersonMeeting,
  PersonProfile,
  RequestMeetingPayload,
} from '../model/person.model';
import { PersonStore } from '../store/person.store';

interface PasswordFormModel {
  readonly newPassword: string;
  readonly currentPassword: string;
}

interface RequestMeetingFormModel {
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly notes: string;
}

const DEFAULT_REQUEST_FORM: RequestMeetingFormModel = {
  date: '',
  time: '',
  duration: '60',
  notes: '',
};

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
  readonly requestSuccess: Signal<boolean> = this.store.requestSuccess;
  readonly error: Signal<string | null> = this.store.error;
  readonly hasPassword: Signal<boolean> = computed(() => this.store.profile()?.hasPassword ?? false);
  readonly canRequestMeeting: Signal<boolean> = computed(
    () => !!this.store.dashboard()?.caseId,
  );

  readonly passwordModel: WritableSignal<PasswordFormModel> = signal({
    newPassword: '',
    currentPassword: '',
  });

  readonly requestModel: WritableSignal<RequestMeetingFormModel> = signal(DEFAULT_REQUEST_FORM);

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

  confirmMeeting(id: string): void {
    this.store.confirmMeeting(id);
  }

  updateRequestField(field: keyof RequestMeetingFormModel, value: string): void {
    this.requestModel.update((current: RequestMeetingFormModel) => ({
      ...current,
      [field]: value,
    }));
  }

  submitMeetingRequest(): string | null {
    const caseId = this.dashboard()?.caseId;
    if (!caseId) {
      return 'noCase';
    }

    const form = this.requestModel();
    if (!form.date || !form.time) {
      return 'required';
    }

    const scheduledAt = new Date(`${form.date}T${form.time}`);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      return 'future';
    }

    const payload: RequestMeetingPayload = {
      careCaseId: caseId,
      scheduledAt: scheduledAt.toISOString(),
      durationMin: Number(form.duration),
      notes: form.notes,
    };
    this.store.requestMeeting(payload);
    return null;
  }

  resetMeetingRequest(): void {
    this.requestModel.set(DEFAULT_REQUEST_FORM);
    this.store.resetRequestSuccess();
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

  startCourse(courseId: string): void {
    this.store.enrollAndStart(courseId);
  }

  completeLesson(courseId: string, lessonId: string): void {
    this.store.completeLesson({ courseId, lessonId });
  }

  completeLessonAndNavigateNext(courseId: string, lessonId: string): void {
    this.store.completeLesson({ courseId, lessonId });

    const course: PersonCourseDetail | null = this.selectedCourse();
    if (!course) {
      this.navigateToCourse(courseId);
      return;
    }

    const sorted: PersonLesson[] = [...course.lessons].sort(
      (a: PersonLesson, b: PersonLesson) => a.orderIndex - b.orderIndex,
    );
    const next: PersonLesson | undefined = sorted.find(
      (l: PersonLesson) => l.id !== lessonId && !l.isCompleted,
    );

    if (next) {
      this.navigateToLesson(courseId, next.id);
    } else {
      this.navigateToCourse(courseId);
    }
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

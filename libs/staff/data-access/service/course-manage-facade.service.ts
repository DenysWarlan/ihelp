import { inject, Injectable, Signal, WritableSignal, signal } from '@angular/core';
import { Router } from '@angular/router';

import { CourseManageStore } from '../store/course-manage.store';
import { CourseManageService } from './course-manage.service';
import {
  AdminCourse,
  AdminCourseDetail,
  AdminLesson,
  CourseStatus,
  CreateCourseFormModel,
  LessonFormModel,
} from '../model/course-manage.model';

@Injectable({ providedIn: 'root' })
export class CourseManageFacade {
  private readonly store = inject(CourseManageStore);
  private readonly router: Router = inject(Router);
  private readonly service: CourseManageService = inject(CourseManageService);

  readonly courses: Signal<AdminCourse[]> = this.store.courses;
  readonly total: Signal<number> = this.store.total;
  readonly selectedCourse: Signal<AdminCourseDetail | null> =
    this.store.selectedCourse;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly isSaving: Signal<boolean> = this.store.isSaving;
  readonly error: Signal<string | null> = this.store.error;

  readonly showCreateModal: WritableSignal<boolean> = signal(false);
  readonly showLessonModal: WritableSignal<boolean> = signal(false);
  readonly editingLesson: WritableSignal<AdminLesson | null> = signal(null);
  readonly isUploading: WritableSignal<boolean> = signal(false);

  readonly createCourseModel: WritableSignal<CreateCourseFormModel> = signal({
    title: '',
    description: '',
  });

  readonly lessonModel: WritableSignal<LessonFormModel> = signal({
    title: '',
    content: '',
    contentType: 'TEXT',
    videoUrl: '',
    imageUrl: '',
    hasTriggerWarning: false,
  });

  loadCourses(source?: 'staff'): void {
    if (source === 'staff') {
      this.store.loadStaffCourses();
    } else {
      this.store.loadCourses();
    }
  }

  loadCourseDetail(id: string): void {
    this.store.loadCourseDetail(id);
  }

  openCreateModal(): void {
    this.createCourseModel.set({ title: '', description: '' });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createCourseModel.set({ title: '', description: '' });
  }

  submitCreate(): void {
    const model: CreateCourseFormModel = this.createCourseModel();
    if (!model.title) {
      return;
    }
    this.store.createCourse(model);
    this.closeCreateModal();
  }

  deleteCourse(id: string): void {
    this.store.deleteCourse(id);
  }

  changeStatus(id: string, status: CourseStatus): void {
    this.store.changeStatus({ id, status });
  }

  updateField(field: keyof CreateCourseFormModel, value: string): void {
    this.createCourseModel.update((m: CreateCourseFormModel) => ({
      ...m,
      [field]: value,
    }));
  }

  updateCourseField(
    field: 'title' | 'description' | 'visibility',
    value: string
  ): void {
    const course = this.selectedCourse();
    if (course) {
      this.store.updateCourse({ id: course.id, dto: { [field]: value } });
    }
  }

  navigateToCourseEdit(id: string): void {
    this.router.navigate(['/staff/courses', id]);
  }

  navigateBackToCourses(): void {
    this.router.navigate(['/staff/courses']);
  }

  // Lesson modal

  openLessonModal(lesson?: AdminLesson): void {
    if (lesson) {
      this.editingLesson.set(lesson);
      this.lessonModel.set({
        title: lesson.title,
        content: lesson.content,
        contentType: lesson.contentType,
        videoUrl: lesson.videoUrl ?? '',
        imageUrl: lesson.imageUrl ?? '',
        hasTriggerWarning: lesson.hasTriggerWarning,
      });
    } else {
      this.editingLesson.set(null);
      this.lessonModel.set({
        title: '',
        content: '',
        contentType: 'TEXT',
        videoUrl: '',
        imageUrl: '',
        hasTriggerWarning: false,
      });
    }
    this.showLessonModal.set(true);
  }

  closeLessonModal(): void {
    this.showLessonModal.set(false);
    this.editingLesson.set(null);
    this.lessonModel.set({
      title: '',
      content: '',
      contentType: 'TEXT',
      videoUrl: '',
      imageUrl: '',
      hasTriggerWarning: false,
    });
    this.isUploading.set(false);
  }

  updateLessonField(field: keyof LessonFormModel, value: string | boolean): void {
    this.lessonModel.update((m: LessonFormModel) => ({
      ...m,
      [field]: value,
    }));
  }

  submitLesson(): void {
    const course = this.selectedCourse();
    if (!course) return;
    const model: LessonFormModel = this.lessonModel();
    if (!model.title) return;

    const dto: {
      title: string;
      content: string;
      contentType: string;
      hasTriggerWarning: boolean;
      videoUrl?: string;
      imageUrl?: string;
    } = {
      title: model.title,
      content: model.content,
      contentType: model.contentType,
      hasTriggerWarning: model.hasTriggerWarning,
    };
    if (model.videoUrl) dto.videoUrl = model.videoUrl;
    if (model.imageUrl) dto.imageUrl = model.imageUrl;

    const editing = this.editingLesson();
    if (editing) {
      this.store.updateLesson({
        courseId: course.id,
        lessonId: editing.id,
        dto,
      });
    } else {
      this.store.createLesson({ courseId: course.id, dto });
    }
    this.closeLessonModal();
  }

  deleteLesson(lessonId: string): void {
    const course = this.selectedCourse();
    if (course) {
      this.store.deleteLesson({ courseId: course.id, lessonId });
    }
  }

  uploadImage(formData: unknown): void {
    this.isUploading.set(true);
    this.service.uploadFile(formData).subscribe({
      next: (result: { key: string; url: string }) => {
        this.lessonModel.update((m: LessonFormModel) => ({
          ...m,
          imageUrl: result.url,
        }));
        this.isUploading.set(false);
      },
      error: () => {
        this.isUploading.set(false);
      },
    });
  }

  getStatusBadgeVariant(
    status: CourseStatus
  ): 'success' | 'warning' | 'neutral' | 'info' {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'DRAFT':
        return 'warning';
      case 'HIDDEN':
        return 'info';
      case 'ARCHIVED':
        return 'neutral';
    }
  }
}

import { inject, Injectable, Signal, WritableSignal, signal } from '@angular/core';

import { CourseManageStore } from '../store/course-manage.store';
import { AdminCourse, CreateCourseFormModel } from '../model/course-manage.model';

@Injectable({ providedIn: 'root' })
export class CourseManageFacade {
  private readonly store = inject(CourseManageStore);

  readonly courses: Signal<AdminCourse[]> = this.store.courses;
  readonly total: Signal<number> = this.store.total;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  readonly showCreateModal: WritableSignal<boolean> = signal(false);

  readonly createCourseModel: WritableSignal<CreateCourseFormModel> = signal({
    title: '',
    description: '',
  });

  loadCourses(): void {
    this.store.loadCourses();
  }

  openCreateModal(): void {
    this.createCourseModel.set({ title: '', description: '' });
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
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

  changeStatus(id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'): void {
    this.store.changeStatus({ id, status });
  }

  updateField(field: keyof CreateCourseFormModel, value: string): void {
    this.createCourseModel.update(
      (m: CreateCourseFormModel) => ({ ...m, [field]: value })
    );
  }

  getStatusBadgeVariant(
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  ): 'success' | 'warning' | 'neutral' {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'DRAFT':
        return 'warning';
      case 'ARCHIVED':
        return 'neutral';
    }
  }
}

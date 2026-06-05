import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  CheckboxComponent,
  IconComponent,
  InputComponent,
  ModalComponent,
  SelectComponent,
  TextareaComponent,
} from '@org/shared/ui';
import { CourseManageFacade, AdminLesson, LessonFormModel } from '@org/staff/data-access';

@Component({
  selector: 'app-course-edit',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    BadgeComponent,
    ButtonComponent,
    CheckboxComponent,
    IconComponent,
    InputComponent,
    ModalComponent,
    SelectComponent,
    TextareaComponent,
  ],
  templateUrl: './course-edit.component.html',
  styleUrl: './course-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseEditComponent implements OnInit {
  protected readonly facade: CourseManageFacade = inject(CourseManageFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  readonly contentTypeOptions = [
    { value: 'TEXT', label: 'Text' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'MIXED', label: 'Mixed' },
  ];

  readonly visibilityOptions = [
    { value: 'PUBLIC', label: 'Public (for clients)' },
    { value: 'STAFF', label: 'Staff (for consultants)' },
  ];

  private courseId = '';

  ngOnInit(): void {
    this.courseId = this.route.snapshot.params['id'];
    if (this.courseId) {
      this.facade.loadCourseDetail(this.courseId);
    }
  }

  protected onBack(): void {
    this.facade.navigateBackToCourses();
  }

  protected onPublish(): void {
    this.facade.changeStatus(this.courseId, 'PUBLISHED');
  }

  protected onHide(): void {
    this.facade.changeStatus(this.courseId, 'HIDDEN');
  }

  protected onDraft(): void {
    this.facade.changeStatus(this.courseId, 'DRAFT');
  }

  protected onSaveTitle(value: string): void {
    this.facade.updateCourseField('title', value);
  }

  protected onSaveDescription(value: string): void {
    this.facade.updateCourseField('description', value);
  }

  protected onSaveVisibility(value: string): void {
    this.facade.updateCourseField('visibility', value);
  }

  protected onAddLesson(): void {
    this.facade.openLessonModal();
  }

  protected onEditLesson(lesson: AdminLesson): void {
    this.facade.openLessonModal(lesson);
  }

  protected onDeleteLesson(lesson: AdminLesson): void {
    this.facade.deleteLesson(lesson.id);
  }

  protected onCloseLessonModal(): void {
    this.facade.closeLessonModal();
  }

  protected onLessonFieldChange(field: keyof LessonFormModel, value: string | boolean): void {
    this.facade.updateLessonField(field, value);
  }

  protected onSubmitLesson(): void {
    this.facade.submitLesson();
  }

  protected onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file: File | undefined = input.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      this.facade.uploadImage(formData);
    }
  }

  protected getLessonIcon(contentType: string): string {
    switch (contentType) {
      case 'VIDEO':
        return 'Play';
      case 'MIXED':
        return 'Layers';
      default:
        return 'BookOpen';
    }
  }
}

import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  InputComponent,
  ModalComponent,
  TextareaComponent,
} from '@org/shared/ui';
import { CourseManageFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-courses-manage',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    DatePipe,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    InputComponent,
    ModalComponent,
    TextareaComponent,
  ],
  templateUrl: './courses-manage.component.html',
  styleUrl: './courses-manage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesManageComponent implements OnInit {
  protected readonly facade: CourseManageFacade = inject(CourseManageFacade);

  ngOnInit(): void {
    this.facade.loadCourses();
  }

  protected onCreateCourse(): void {
    this.facade.openCreateModal();
  }

  protected onCloseCreateModal(): void {
    this.facade.closeCreateModal();
  }

  protected onSubmitCreate(): void {
    this.facade.submitCreate();
  }

  protected onFieldChange(field: 'title' | 'description', value: string): void {
    this.facade.updateField(field, value);
  }

  protected onArchiveCourse(id: string): void {
    this.facade.changeStatus(id, 'ARCHIVED');
  }
}

import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  IconComponent,
  InputComponent,
  ModalComponent,
  TextareaComponent,
} from '@org/shared/ui';
import { CourseManageFacade, CourseStatus } from '@org/staff/data-access';

@Component({
  selector: 'app-courses-manage',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    LowerCasePipe,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
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

  protected onEditCourse(id: string): void {
    this.facade.navigateToCourseEdit(id);
  }

  protected onChangeStatus(id: string, status: CourseStatus): void {
    this.facade.changeStatus(id, status);
  }
}

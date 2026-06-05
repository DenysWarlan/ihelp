import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { DOCUMENT, LowerCasePipe } from '@angular/common';
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
  private readonly doc: Document = inject(DOCUMENT);
  readonly isAdmin: WritableSignal<boolean> = signal(false);

  ngOnInit(): void {
    const win = this.doc.defaultView;
    const role: string = win?.localStorage?.getItem('ihelp_user_role') ?? '';
    this.isAdmin.set(role === 'admin' || role === 'coordinator');
    this.facade.loadCourses(this.isAdmin() ? undefined : 'staff');
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

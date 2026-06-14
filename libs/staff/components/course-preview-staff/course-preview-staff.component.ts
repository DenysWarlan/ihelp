import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ButtonComponent, IconComponent } from '@org/shared/ui';
import { CourseManageFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-course-preview-staff',
  standalone: true,
  imports: [TranslocoDirective, BadgeComponent, ButtonComponent, IconComponent],
  templateUrl: './course-preview-staff.component.html',
  styleUrl: './course-preview-staff.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursePreviewStaffComponent implements OnInit {
  protected readonly facade: CourseManageFacade = inject(CourseManageFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  private courseId = '';
  private readonly isAdmin: boolean;

  constructor() {
    const win: Window | undefined = typeof window !== 'undefined' ? window : undefined;
    const role: string = win?.localStorage?.getItem('ihelp_user_role') ?? '';
    this.isAdmin = role === 'admin' || role === 'coordinator';
  }

  ngOnInit(): void {
    this.courseId = this.route.snapshot.params['id'];
    if (this.courseId) {
      this.facade.loadCourseDetail(this.courseId, this.isAdmin ? undefined : 'staff');
    }
  }

  protected onBackToEdit(): void {
    this.facade.navigateToCourseEdit(this.courseId);
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

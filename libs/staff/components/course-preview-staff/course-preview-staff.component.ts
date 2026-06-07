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

  ngOnInit(): void {
    this.courseId = this.route.snapshot.params['id'];
    if (this.courseId) {
      this.facade.loadCourseDetail(this.courseId);
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

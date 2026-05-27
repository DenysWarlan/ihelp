import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CoursesFacade } from '@org/public/data-access';
import { IconComponent } from '@org/shared/ui';

import { AuthModalComponent } from '../auth-modal/auth-modal.component';

@Component({
  selector: 'app-course-preview',
  standalone: true,
  imports: [RouterLink, TranslocoDirective, IconComponent, AuthModalComponent],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursePreviewComponent {
  private readonly facade: CoursesFacade = inject(CoursesFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  readonly course = this.facade.selectedCourse;
  readonly isLoading = this.facade.isLoading;
  readonly isAuthModalOpen = signal<boolean>(false);

  private courseId = '';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.courseId = id;
      this.facade.loadCourse(id);
    }
  }

  onStartCourse(): void {
    const win = this.doc.defaultView;
    const token = win?.localStorage.getItem('ihelp_token');
    if (token) {
      this.router.navigate(['/person/courses', this.courseId], {
        queryParams: { autostart: '1' },
      });
    } else {
      this.isAuthModalOpen.set(true);
    }
  }

  closeAuthModal(): void {
    this.isAuthModalOpen.set(false);
  }

  get currentCourseId(): string {
    return this.courseId;
  }
}

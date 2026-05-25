import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

  openAuthModal(): void {
    this.isAuthModalOpen.set(true);
  }

  closeAuthModal(): void {
    this.isAuthModalOpen.set(false);
  }

  get currentCourseId(): string {
    return this.courseId;
  }
}

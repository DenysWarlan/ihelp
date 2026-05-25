import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CoursesFacade } from '@org/public/data-access';
import { IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-course-preview',
  standalone: true,
  imports: [RouterLink, TranslocoDirective, IconComponent],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursePreviewComponent {
  private readonly facade: CoursesFacade = inject(CoursesFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  readonly course = this.facade.selectedCourse;
  readonly isLoading = this.facade.isLoading;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.facade.loadCourse(id);
    }
  }
}

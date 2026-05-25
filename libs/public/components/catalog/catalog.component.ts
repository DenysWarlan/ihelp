import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CoursesFacade } from '@org/public/data-access';
import { IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoDirective],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent {
  private readonly facade: CoursesFacade = inject(CoursesFacade);

  readonly courses = this.facade.courses;
  readonly isLoading = this.facade.isLoading;

  constructor() {
    this.facade.loadCourses();
  }
}

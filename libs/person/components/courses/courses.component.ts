import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  CardComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [
    TranslocoDirective,
    CardComponent,
    IconComponent,
    ProgressBarComponent,
    BadgeComponent,
  ],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);

  ngOnInit(): void {
    this.facade.loadCourses();
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      default:
        return 'neutral';
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

import type { PersonCourse } from '@org/person/data-access';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [
    TranslocoDirective,
    IconComponent,
    ProgressBarComponent,
    BadgeComponent,
    ButtonComponent,
  ],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);
  private readonly router: Router = inject(Router);

  readonly activeCourses: Signal<PersonCourse[]> = computed(() =>
    this.facade.courses().filter((c) => c.status === 'in_progress')
  );

  readonly recommendedCourses: Signal<PersonCourse[]> = computed(() =>
    this.facade.courses().filter((c) => c.status === 'not_started')
  );

  ngOnInit(): void {
    this.facade.loadCourses();
    this.facade.loadDashboard();
  }

  onWriteConsultant(): void {
    if (this.facade.dashboard()?.consultantName) {
      this.router.navigate(['/person/chat']);
    } else {
      this.router.navigate(['/person/request-help']);
    }
  }
}

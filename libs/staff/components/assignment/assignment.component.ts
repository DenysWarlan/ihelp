import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { AssignmentSuggestion } from '@org/staff/data-access';

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(CoordinatorFacadeService);

  readonly assignments: Signal<AssignmentSuggestion[]> = this.facade.assignments;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadAssignmentSuggestions();
  }
}

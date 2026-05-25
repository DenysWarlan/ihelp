import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  type Signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  AlertBannerComponent,
  BadgeComponent,
  ButtonComponent,
} from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type {
  AssignmentSuggestion,
  SlaOverview,
} from '@org/staff/data-access';

@Component({
  selector: 'app-coordinator',
  standalone: true,
  imports: [
    TranslocoDirective,
    AlertBannerComponent,
    BadgeComponent,
    ButtonComponent,
  ],
  templateUrl: './coordinator.component.html',
  styleUrl: './coordinator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoordinatorComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(
    CoordinatorFacadeService
  );

  readonly slaOverview: Signal<SlaOverview | null> = this.facade.slaOverview;
  readonly assignments: Signal<AssignmentSuggestion[]> =
    this.facade.assignments;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  readonly unacknowledgedCrisisCount: Signal<number> = computed(() => {
    const alerts = this.facade.crisisAlerts();
    return alerts.filter((a) => !a.isAcknowledged).length;
  });

  ngOnInit(): void {
    this.facade.loadSlaOverview();
    this.facade.loadAssignmentSuggestions();
    this.facade.loadCrisisAlerts();
  }

  getPriorityVariant(
    reason: string
  ): 'error' | 'warning' | 'success' | 'info' | 'neutral' {
    const lower = reason.toLowerCase();
    if (lower.includes('критич') || lower.includes('critical')) {
      return 'error';
    }
    if (lower.includes('висок') || lower.includes('high')) {
      return 'warning';
    }
    if (lower.includes('середн') || lower.includes('medium')) {
      return 'info';
    }
    return 'neutral';
  }
}

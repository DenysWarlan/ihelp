import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  IconComponent,
  AlertBannerComponent,
  ButtonComponent,
} from '@org/shared/ui';
import type { BadgeVariant } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { CrisisAlert } from '@org/staff/data-access';

@Component({
  selector: 'app-crisis',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    IconComponent,
    AlertBannerComponent,
    ButtonComponent,
  ],
  templateUrl: './crisis.component.html',
  styleUrl: './crisis.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrisisComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(CoordinatorFacadeService);

  readonly crisisAlerts: Signal<CrisisAlert[]> = this.facade.crisisAlerts;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;
  readonly hasUnacknowledged: Signal<boolean> = computed(() =>
    this.crisisAlerts().some((alert: CrisisAlert) => !alert.isAcknowledged)
  );
  readonly unacknowledgedCount: Signal<number> = computed(() =>
    this.crisisAlerts().filter((alert: CrisisAlert) => !alert.isAcknowledged).length
  );

  ngOnInit(): void {
    this.facade.loadCrisisAlerts();
  }

  getSeverityVariant(severity: string): BadgeVariant {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  onAcknowledge(id: string): void {
    this.facade.acknowledgeCrisis(id);
  }
}

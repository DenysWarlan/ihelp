import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, IconComponent } from '@org/shared/ui';
import type { BadgeVariant } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { SlaOverview } from '@org/staff/data-access';

@Component({
  selector: 'app-sla-monitor',
  standalone: true,
  imports: [TranslocoDirective, BadgeComponent, IconComponent],
  templateUrl: './sla-monitor.component.html',
  styleUrl: './sla-monitor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlaMonitorComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(CoordinatorFacadeService);

  readonly slaOverview: Signal<SlaOverview | null> = this.facade.slaOverview;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadSlaOverview();
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'ON_TRACK':
        return 'success';
      case 'AT_RISK':
        return 'warning';
      case 'BREACHED':
        return 'error';
      default:
        return 'neutral';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'ON_TRACK':
        return 'CheckCircle';
      case 'AT_RISK':
        return 'Clock';
      case 'BREACHED':
        return 'AlertTriangle';
      default:
        return 'Info';
    }
  }

  getProgressPercent(remainingMinutes: number): number {
    const maxMinutes: number = 480;
    if (remainingMinutes <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((remainingMinutes / maxMinutes) * 100));
  }

  formatRemaining(minutes: number): string {
    if (minutes < 0) {
      return 'Прострочено';
    }
    const hours: number = Math.floor(minutes / 60);
    const mins: number = minutes % 60;
    return hours > 0 ? `${hours}г ${mins}хв` : `${mins}хв`;
  }
}

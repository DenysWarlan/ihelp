import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, IconComponent } from '@org/shared/ui';
import type { BadgeVariant } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { SlaOverview, SlaTimer } from '@org/staff/data-access';

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

  getProgressPercent(timer: SlaTimer): number {
    if (timer.status === 'BREACHED') {
      return 100;
    }
    const elapsed = timer.elapsedMinutes ?? 0;
    const remaining = timer.remainingMinutes ?? 0;
    const total = remaining + elapsed;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((elapsed / total) * 100));
  }

  formatTime(timer: SlaTimer): string {
    if (timer.status === 'BREACHED') {
      return this.formatDuration(timer.elapsedMinutes ?? 0);
    }
    return this.formatDuration(timer.remainingMinutes ?? 0);
  }

  private formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '0хв';
    const days: number = Math.floor(minutes / 1440);
    const hours: number = Math.floor((minutes % 1440) / 60);
    const mins: number = minutes % 60;
    if (days > 0) return `${days}д ${hours}г`;
    if (hours > 0) return `${hours}г ${mins}хв`;
    return `${mins}хв`;
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent } from '@org/shared/ui';
import type { BadgeVariant } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { CrisisHistoryItem } from '@org/staff/data-access';

@Component({
  selector: 'app-crisis-history',
  standalone: true,
  imports: [TranslocoDirective, BadgeComponent, DatePipe],
  templateUrl: './crisis-history.component.html',
  styleUrl: './crisis-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrisisHistoryComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(
    SupervisorFacadeService
  );

  readonly crisisHistory: Signal<CrisisHistoryItem[]> =
    this.facade.crisisHistory;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  readonly activeFilter: WritableSignal<string> = signal('all');

  readonly filteredHistory: Signal<CrisisHistoryItem[]> = computed(() => {
    const items: CrisisHistoryItem[] = this.crisisHistory();
    const filter: string = this.activeFilter();
    if (filter === 'all') return items;
    return items.filter(
      (item: CrisisHistoryItem) => item.severity === filter
    );
  });

  readonly totalAlerts: Signal<number> = computed(
    () => this.crisisHistory().length
  );

  readonly criticalCount: Signal<number> = computed(
    () =>
      this.crisisHistory().filter(
        (i: CrisisHistoryItem) => i.severity === 'critical'
      ).length
  );

  readonly escalationRate: Signal<string> = computed(() => {
    const total: number = this.crisisHistory().length;
    if (total === 0) return '0%';
    const escalated: number = this.crisisHistory().filter(
      (i: CrisisHistoryItem) => i.isEscalated
    ).length;
    return Math.round((escalated / total) * 100) + '%';
  });

  readonly filters: string[] = ['all', 'critical', 'high', 'moderate'];

  ngOnInit(): void {
    this.facade.loadCrisisHistory();
  }

  setFilter(filter: string): void {
    this.activeFilter.set(filter);
  }

  getSeverityVariant(severity: string): BadgeVariant {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'moderate':
        return 'info';
      default:
        return 'neutral';
    }
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'resolved':
        return 'success';
      case 'active':
        return 'warning';
      case 'escalated':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

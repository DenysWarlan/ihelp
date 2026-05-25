import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { TeamAnalytics } from '@org/staff/data-access';

interface TopicItem {
  label: string;
  count: number;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [TranslocoDirective, CardComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(SupervisorFacadeService);

  readonly teamAnalytics: Signal<TeamAnalytics | null> = this.facade.teamAnalytics;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  readonly activeCasesCount: Signal<number> = computed(() => {
    const analytics: TeamAnalytics | null = this.teamAnalytics();
    if (!analytics) {
      return 0;
    }
    return analytics.totalCasesThisMonth - analytics.resolvedCases;
  });

  readonly topicData: TopicItem[] = [
    { label: 'Психологічна підтримка', count: 45, percent: 80, color: 'orange' },
    { label: 'Юридична допомога', count: 38, percent: 68, color: 'green' },
    { label: 'Соціальна допомога', count: 32, percent: 57, color: 'teal' },
    { label: 'Медична допомога', count: 25, percent: 45, color: 'purple' },
    { label: 'Освітні послуги', count: 16, percent: 29, color: 'pink' },
  ];

  ngOnInit(): void {
    this.facade.loadTeamAnalytics();
  }

  getBarWidth(activeCases: number): number {
    const members = this.teamAnalytics()?.teamMembers ?? [];
    const max: number = Math.max(...members.map((m) => m.activeCases), 1);
    return (activeCases / max) * 100;
  }
}

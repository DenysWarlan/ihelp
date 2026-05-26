import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { SupervisorFacadeService } from '@org/staff/data-access';
import type { TeamAnalytics, TeamMember } from '@org/staff/data-access';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(SupervisorFacadeService);

  readonly teamAnalytics: Signal<TeamAnalytics | null> = this.facade.teamAnalytics;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  readonly escalationCount: Signal<number> = computed(() => {
    const analytics: TeamAnalytics | null = this.teamAnalytics();
    if (!analytics) {
      return 0;
    }
    return Math.max(0, analytics.totalCasesThisMonth - analytics.resolvedCases);
  });

  ngOnInit(): void {
    this.facade.loadTeamAnalytics();
  }

  getRating(member: TeamMember): number {
    return member.resolvedThisMonth > 0
      ? Math.round((member.resolvedThisMonth / Math.max(member.activeCases, 1)) * 10) / 10
      : 0;
  }
}

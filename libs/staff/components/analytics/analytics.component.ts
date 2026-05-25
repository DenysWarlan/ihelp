import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { TeamAnalytics } from '@org/staff/data-access';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(SupervisorFacadeService);

  readonly teamAnalytics: Signal<TeamAnalytics | null> = this.facade.teamAnalytics;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadTeamAnalytics();
  }
}

import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, BadgeComponent, IconComponent } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { TeamMember } from '@org/staff/data-access';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, BadgeComponent, IconComponent],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(SupervisorFacadeService);

  readonly teamMembers: Signal<TeamMember[]> = this.facade.teamMembers;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadTeamMembers();
  }
}

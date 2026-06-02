import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ButtonComponent, IconComponent } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { CaseListItem, ConsultantProfile, TeamMember } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-consultant-profile',
  standalone: true,
  imports: [TranslocoDirective, BadgeComponent, ButtonComponent, IconComponent, DatePipe],
  templateUrl: './consultant-profile.component.html',
  styleUrl: './consultant-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultantProfileComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(SupervisorFacadeService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  readonly profile: Signal<ConsultantProfile | null> = this.facade.consultantProfile;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  readonly member: Signal<TeamMember | null> = computed(() => {
    const userId: string = this.route.snapshot.params['userId'];
    return this.facade.teamMembers().find((m: TeamMember) => m.id === userId) ?? null;
  });

  readonly consultantCases: Signal<CaseListItem[]> = computed(() => {
    const userId: string = this.route.snapshot.params['userId'];
    if (!userId) return [];
    return this.facade.allCases().filter(
      (c: CaseListItem) => c.consultantUserId === userId,
    );
  });

  readonly activeCases: Signal<CaseListItem[]> = computed(() =>
    this.consultantCases().filter(
      (c: CaseListItem) => c.status !== 'COMPLETED' && c.status !== 'CLOSED',
    ),
  );

  readonly completedCases: Signal<CaseListItem[]> = computed(() =>
    this.consultantCases().filter(
      (c: CaseListItem) => c.status === 'COMPLETED' || c.status === 'CLOSED',
    ),
  );

  ngOnInit(): void {
    const userId: string = this.route.snapshot.params['userId'];
    if (userId) {
      this.facade.loadConsultantProfile(userId);
      this.facade.loadAllCases();
      this.facade.loadTeamMembers();
    }
  }

  onBack(): void {
    this.router.navigate(['/staff/team']);
  }

  onCaseClick(id: string): void {
    this.router.navigate(['/staff/supervisor/cases', id]);
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'NEW':
      case 'ASSIGNED':
        return 'info';
      case 'IN_PROGRESS':
      case 'MEETING_SCHEDULED':
        return 'warning';
      case 'ON_HOLD':
      case 'TRANSFERRED':
        return 'neutral';
      case 'COMPLETED':
        return 'success';
      case 'CLOSED':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  getPriorityVariant(priority: string): BadgeVariant {
    switch (priority) {
      case 'CRISIS':
        return 'error';
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'neutral';
      default:
        return 'neutral';
    }
  }
}

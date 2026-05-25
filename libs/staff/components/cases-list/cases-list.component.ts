import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import { AlertBannerComponent, BadgeComponent, ButtonComponent, IconComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-cases-list',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    AlertBannerComponent,
    DatePipe,
  ],
  templateUrl: './cases-list.component.html',
  styleUrl: './cases-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasesListComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);

  readonly cases = this.facade.cases;
  readonly dashboard = this.facade.dashboard;
  readonly isLoading = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadCases();
    this.facade.loadDashboard();
  }

  onCaseClick(id: string): void {
    this.facade.navigateToCase(id);
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'OPEN':
        return 'success';
      case 'IN_PROGRESS':
        return 'info';
      case 'WAITING':
        return 'neutral';
      case 'RESOLVED':
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

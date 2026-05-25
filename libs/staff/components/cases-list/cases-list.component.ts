import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, CardComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-cases-list',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, BadgeComponent, DatePipe],
  templateUrl: './cases-list.component.html',
  styleUrl: './cases-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasesListComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);

  readonly cases = this.facade.cases;
  readonly isLoading = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadCases();
  }

  onCaseClick(id: string): void {
    this.facade.navigateToCase(id);
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'OPEN':
        return 'info';
      case 'IN_PROGRESS':
        return 'warning';
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
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'neutral';
      default:
        return 'neutral';
    }
  }
}

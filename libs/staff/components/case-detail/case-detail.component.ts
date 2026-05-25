import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, CardComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, BadgeComponent, DatePipe],
  templateUrl: './case-detail.component.html',
  styleUrl: './case-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetailComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  readonly selectedCase = this.facade.selectedCase;
  readonly isLoading = this.facade.isLoading;

  ngOnInit(): void {
    const id: string = this.route.snapshot.params['id'];
    if (id) {
      this.facade.loadCaseDetail(id);
    }
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

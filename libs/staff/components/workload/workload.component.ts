import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import type { BadgeVariant, ProgressBarVariant } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { WorkloadEntry, ConsultantDetail } from '@org/staff/data-access';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    IconComponent,
    ProgressBarComponent,
    DatePipe,
  ],
  templateUrl: './workload.component.html',
  styleUrl: './workload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkloadComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(CoordinatorFacadeService);

  readonly workload: Signal<WorkloadEntry[]> = this.facade.workload;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;
  readonly consultantDetail: Signal<ConsultantDetail | null> = this.facade.consultantDetail;

  readonly expandedId: WritableSignal<string | null> = signal(null);

  ngOnInit(): void {
    this.facade.loadWorkload();
  }

  toggleExpand(consultantId: string): void {
    if (this.expandedId() === consultantId) {
      this.expandedId.set(null);
      this.facade.clearConsultantDetail();
    } else {
      this.expandedId.set(consultantId);
      this.facade.loadConsultantCases(consultantId);
    }
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'AT_CAPACITY':
        return 'warning';
      case 'OVERLOADED':
        return 'error';
      default:
        return 'neutral';
    }
  }

  getProgressVariant(status: string): ProgressBarVariant {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'AT_CAPACITY':
      case 'OVERLOADED':
        return 'warning';
      default:
        return 'default';
    }
  }

  getCaseStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'NEW': return 'info';
      case 'ASSIGNED': return 'info';
      case 'IN_PROGRESS': return 'warning';
      case 'WAITING': return 'neutral';
      case 'RESOLVED': return 'success';
      default: return 'neutral';
    }
  }

  getCasePriorityVariant(priority: string): BadgeVariant {
    switch (priority) {
      case 'CRISIS': return 'error';
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'neutral';
      default: return 'neutral';
    }
  }
}

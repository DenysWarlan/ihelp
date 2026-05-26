import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import type { BadgeVariant, ProgressBarVariant } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { AssignmentSuggestion, AssignmentPriority, WorkloadEntry } from '@org/staff/data-access';

@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    ProgressBarComponent,
  ],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(CoordinatorFacadeService);

  readonly assignments: Signal<AssignmentSuggestion[]> = this.facade.assignments;
  readonly workload: Signal<WorkloadEntry[]> = this.facade.workload;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadAssignmentSuggestions();
    this.facade.loadWorkload();
  }

  getPriorityVariant(priority: AssignmentPriority): BadgeVariant {
    switch (priority) {
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'success';
      default:
        return 'neutral';
    }
  }

  getWorkloadVariant(status: string): ProgressBarVariant {
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

  onConfirm(item: AssignmentSuggestion): void {
    this.facade.confirmAssignment(item.caseId, item.suggestedConsultantId);
  }

  onReject(caseId: string): void {
    this.facade.rejectAssignment(caseId);
  }
}

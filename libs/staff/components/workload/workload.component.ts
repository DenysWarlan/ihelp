import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import type { BadgeVariant, ProgressBarVariant } from '@org/shared/ui';
import { CoordinatorFacadeService } from '@org/staff/data-access';
import type { WorkloadEntry } from '@org/staff/data-access';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    IconComponent,
    ProgressBarComponent,
  ],
  templateUrl: './workload.component.html',
  styleUrl: './workload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkloadComponent implements OnInit {
  private readonly facade: CoordinatorFacadeService = inject(CoordinatorFacadeService);

  readonly workload: Signal<WorkloadEntry[]> = this.facade.workload;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadWorkload();
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
}

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ButtonComponent } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';
import type { SupervisorCaseDetail } from '@org/staff/data-access';

@Component({
  selector: 'app-supervisor-case-detail',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    ButtonComponent,
    DatePipe,
    FormsModule,
  ],
  templateUrl: './supervisor-case-detail.component.html',
  styleUrl: './supervisor-case-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorCaseDetailComponent implements OnInit {
  private readonly facade: SupervisorFacadeService = inject(
    SupervisorFacadeService
  );
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  readonly caseDetail: Signal<SupervisorCaseDetail | null> =
    this.facade.supervisorCaseDetail;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;
  readonly supervisorComment: WritableSignal<string> = signal('');

  ngOnInit(): void {
    const id: string = this.route.snapshot.params['id'];
    if (id) {
      this.facade.loadSupervisorCaseDetail(id);
    }
  }

  onSendComment(): void {
    const detail: SupervisorCaseDetail | null = this.caseDetail();
    const comment: string = this.supervisorComment().trim();
    if (detail && comment) {
      this.facade.addSupervisorComment(detail.id, comment);
      this.supervisorComment.set('');
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

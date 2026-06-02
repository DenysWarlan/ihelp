import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ButtonComponent, IconComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';
import type { CaseDetail } from '@org/staff/data-access';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [TranslocoDirective, BadgeComponent, ButtonComponent, IconComponent, DatePipe, FormsModule],
  templateUrl: './case-detail.component.html',
  styleUrl: './case-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetailComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  readonly selectedCase: Signal<CaseDetail | null> = this.facade.selectedCase;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;
  readonly error: Signal<string | null> = this.facade.error;
  readonly messageInput: WritableSignal<string> = signal('');
  readonly showCompleteConfirm: WritableSignal<boolean> = signal(false);

  readonly messagesCount: Signal<number> = computed(
    () => this.selectedCase()?.messages.length ?? 0,
  );

  readonly notesCount: Signal<number> = computed(
    () => this.selectedCase()?.notes.length ?? 0,
  );

  readonly canComplete: Signal<boolean> = computed(() => {
    const c: CaseDetail | null = this.selectedCase();
    return !!c && (c.status === 'IN_PROGRESS' || c.status === 'MEETING_SCHEDULED');
  });

  ngOnInit(): void {
    const id: string = this.route.snapshot.params['id'];
    if (id) {
      this.facade.loadCaseDetail(id);
    }
  }

  onSendMessage(): void {
    const c: CaseDetail | null = this.selectedCase();
    const text: string = this.messageInput().trim();
    if (c && text) {
      this.facade.sendCaseMessage(c.id, text);
      this.messageInput.set('');
    }
  }

  onScheduleMeeting(): void {
    const c: CaseDetail | null = this.selectedCase();
    if (c) {
      this.router.navigate(['/staff/meetings/schedule', c.id]);
    }
  }

  onReassign(): void {
    this.router.navigate(['/staff/assignment']);
  }

  onCompleteCase(): void {
    this.showCompleteConfirm.set(true);
  }

  onConfirmComplete(): void {
    const c: CaseDetail | null = this.selectedCase();
    if (c) {
      this.facade.completeCase(c.id, c.version);
      this.showCompleteConfirm.set(false);
    }
  }

  onCancelComplete(): void {
    this.showCompleteConfirm.set(false);
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

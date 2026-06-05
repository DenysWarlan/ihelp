import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent, ButtonComponent, BadgeComponent } from '@org/shared/ui';
import type { BadgeVariant } from '@org/shared/ui';
import { StaffChatFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-staff-chat',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslocoDirective, IconComponent, ButtonComponent, BadgeComponent],
  templateUrl: './staff-chat.component.html',
  styleUrl: './staff-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffChatComponent implements OnInit {
  readonly facade: StaffChatFacade = inject(StaffChatFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  messageText = '';

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  constructor() {
    effect(() => {
      // Track the messages signal — scroll when it changes
      const msgs = this.facade.messages();
      if (msgs.length > 0) {
        (globalThis as unknown as { setTimeout: (fn: () => void) => void }).setTimeout(() => this.scrollToBottom());
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadConversations();

    const caseId: string | null = this.route.snapshot.queryParamMap.get('caseId');
    if (caseId) {
      this.facade.selectConversation(caseId);
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  selectConversation(id: string): void {
    this.facade.selectConversation(id);
  }

  onChatFocus(): void {
    this.facade.markMessagesAsRead();
  }

  sendMessage(): void {
    if (this.messageText.trim()) {
      this.facade.sendMessage(this.messageText);
      this.messageText = '';
    }
  }

  getStatusVariant(status: string): BadgeVariant {
    const map: Record<string, BadgeVariant> = {
      NEW: 'info',
      ASSIGNED: 'info',
      IN_PROGRESS: 'info',
      MEETING_SCHEDULED: 'warning',
      ON_HOLD: 'warning',
      TRANSFERRED: 'info',
      COMPLETED: 'success',
      CLOSED: 'neutral',
      ESCALATED: 'error',
    };
    return map[status] ?? 'neutral';
  }
}

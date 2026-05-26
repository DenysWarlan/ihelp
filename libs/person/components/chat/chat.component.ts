import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  Signal,
  ViewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '@org/shared/ui';
import { ChatFacade, ChatConversation } from '@org/person/data-access';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslocoDirective, IconComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit {
  readonly facade: ChatFacade = inject(ChatFacade);
  readonly activeConversation: Signal<ChatConversation | null> = computed(
    () => this.facade.conversations()[0] ?? null
  );
  messageText = '';

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  constructor() {
    effect(() => {
      const conversations = this.facade.conversations();
      if (conversations.length > 0 && !this.facade.selectedConversationId()) {
        this.facade.selectConversation(conversations[0].id);
      }
    });

    effect(() => {
      const msgs = this.facade.messages();
      if (msgs.length > 0) {
        (globalThis as unknown as { setTimeout: (fn: () => void) => void }).setTimeout(() => this.scrollToBottom());
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadConversations();
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
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
}

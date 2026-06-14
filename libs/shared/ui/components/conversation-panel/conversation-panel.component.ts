import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  Signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  Conversation,
  ConversationContact,
  ConversationFacade,
  ConversationMessage,
} from '@org/shared/data-access';

import { IconComponent } from '../icon/icon.component';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'ui-conversation-panel',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslocoDirective,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './conversation-panel.component.html',
  styleUrl: './conversation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationPanelComponent implements OnInit {
  /** When true, shows the "new chat" button + contact picker (staff surfaces). */
  readonly canStart = input<boolean>(false);

  readonly facade: ConversationFacade = inject(ConversationFacade);

  private readonly messagesContainer =
    viewChild<ElementRef<HTMLElement>>('messagesContainer');

  readonly messageText: WritableSignal<string> = signal('');

  // Contact-picker state
  readonly showPicker: WritableSignal<boolean> = signal(false);
  readonly contactSearch: WritableSignal<string> = signal('');
  readonly groupTitle: WritableSignal<string> = signal('');
  readonly selectedContactIds: WritableSignal<string[]> = signal([]);

  readonly filteredContacts: Signal<ConversationContact[]> = computed(() => {
    const term = this.contactSearch().trim().toLowerCase();
    const contacts = this.facade.contacts();
    if (!term) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(term));
  });

  readonly isGroup: Signal<boolean> = computed(
    () => this.selectedContactIds().length > 1,
  );

  constructor() {
    effect(() => {
      const msgs = this.facade.messages();
      if (msgs.length > 0) {
        this.scheduleScroll();
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadConversations();
    if (this.canStart()) {
      this.facade.loadContacts();
    }
  }

  selectConversation(conversationId: string): void {
    this.facade.selectConversation(conversationId);
  }

  isMine(msg: ConversationMessage): boolean {
    return msg.senderId === this.facade.currentUserId();
  }

  label(conversation: Conversation): string {
    return this.facade.conversationLabel(conversation);
  }

  onSend(): void {
    const text = this.messageText().trim();
    if (text) {
      this.facade.sendMessage(text);
      this.messageText.set('');
    }
  }

  onFocusThread(): void {
    this.facade.markRead();
  }

  // --- Contact picker ---

  openPicker(): void {
    this.selectedContactIds.set([]);
    this.groupTitle.set('');
    this.contactSearch.set('');
    this.showPicker.set(true);
  }

  closePicker(): void {
    this.showPicker.set(false);
  }

  toggleContact(contactId: string): void {
    const current = this.selectedContactIds();
    this.selectedContactIds.set(
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  }

  isContactSelected(contactId: string): boolean {
    return this.selectedContactIds().includes(contactId);
  }

  confirmStart(): void {
    const ids = this.selectedContactIds();
    if (ids.length === 0) return;
    const title = this.isGroup() ? this.groupTitle().trim() || undefined : undefined;
    this.facade.startConversation(ids, title);
    this.showPicker.set(false);
  }

  private scheduleScroll(): void {
    (
      globalThis as unknown as { setTimeout: (fn: () => void) => void }
    ).setTimeout(() => {
      const el = this.messagesContainer()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}

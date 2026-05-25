import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent, ButtonComponent } from '@org/shared/ui';
import { ChatFacade } from '@org/person/data-access';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, IconComponent, ButtonComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit {
  readonly facade: ChatFacade = inject(ChatFacade);
  messageText = '';

  ngOnInit(): void {
    this.facade.loadConversations();
  }

  selectConversation(id: string): void {
    this.facade.selectConversation(id);
  }

  sendMessage(): void {
    if (this.messageText.trim()) {
      this.facade.sendMessage(this.messageText);
      this.messageText = '';
    }
  }
}

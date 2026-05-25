import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent, ButtonComponent } from '@org/shared/ui';
import { StaffChatFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-staff-chat',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, IconComponent, ButtonComponent],
  templateUrl: './staff-chat.component.html',
  styleUrl: './staff-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffChatComponent implements OnInit {
  readonly facade: StaffChatFacade = inject(StaffChatFacade);
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

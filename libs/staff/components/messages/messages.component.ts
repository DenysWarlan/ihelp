import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ConversationPanelComponent } from '@org/shared/ui';

@Component({
  selector: 'app-staff-messages',
  standalone: true,
  imports: [ConversationPanelComponent],
  template: `<ui-conversation-panel [canStart]="true" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffMessagesComponent {}

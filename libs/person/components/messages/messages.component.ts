import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ConversationPanelComponent } from '@org/shared/ui';

@Component({
  selector: 'app-person-messages',
  standalone: true,
  imports: [ConversationPanelComponent],
  template: `<ui-conversation-panel [canStart]="false" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonMessagesComponent {}

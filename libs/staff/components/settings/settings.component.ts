import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  protected readonly categories: readonly { key: string; icon: string }[] = [
    { key: 'sla', icon: 'Clock' },
    { key: 'assignment', icon: 'UserCheck' },
    { key: 'crisis', icon: 'AlertTriangle' },
    { key: 'notifications', icon: 'Bell' },
  ];
}

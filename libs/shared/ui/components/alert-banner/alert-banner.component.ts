import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import type { AlertBannerVariant } from './alert-banner.model';

@Component({
  selector: 'ui-alert-banner',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertBannerComponent {
  readonly variant = input<AlertBannerVariant>('info');
  readonly dismissible = input<boolean>(false);

  readonly dismissed = output<void>();

  protected readonly isVisible = signal<boolean>(true);

  protected get iconName(): string {
    switch (this.variant()) {
      case 'crisis':
        return 'CircleAlert';
      case 'warning':
        return 'TriangleAlert';
      case 'info':
        return 'Info';
    }
  }

  protected onDismiss(): void {
    this.isVisible.set(false);
    this.dismissed.emit();
  }
}

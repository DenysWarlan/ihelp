import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ToastService } from './toast.service';

@Component({
  selector: 'ui-toast-container',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  getIcon(variant: string): string {
    const map: Record<string, string> = {
      info: 'MessageCircle',
      success: 'CheckCircle',
      warning: 'AlertTriangle',
      error: 'AlertCircle',
    };
    return map[variant] ?? 'Info';
  }
}

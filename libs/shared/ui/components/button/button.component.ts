import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ButtonSize, ButtonType, ButtonVariant } from './button.model';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly type = input<ButtonType>('button');

  readonly isDisabled = computed(() => this.disabled() || this.loading());

  readonly hostClasses = computed(() => {
    return [
      'btn',
      `btn--${this.variant()}`,
      `btn--${this.size()}`,
      this.loading() ? 'btn--loading' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });
}

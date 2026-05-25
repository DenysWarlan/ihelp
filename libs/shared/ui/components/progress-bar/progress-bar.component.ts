import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { ProgressBarVariant } from './progress-bar.model';

@Component({
  selector: 'ui-progress-bar',
  standalone: true,
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"progress-bar progress-bar--" + variant()',
  },
})
export class ProgressBarComponent {
  readonly value = input<number>(0);
  readonly showLabel = input<boolean>(false);
  readonly variant = input<ProgressBarVariant>('default');

  protected readonly clampedValue = computed(() =>
    Math.max(0, Math.min(100, this.value())),
  );
}

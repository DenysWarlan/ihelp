import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { BadgeSize, BadgeVariant } from './badge.model';

@Component({
  selector: 'ui-badge',
  standalone: true,
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"badge badge--" + variant() + " badge--" + size()',
  },
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');
  readonly size = input<BadgeSize>('md');
}

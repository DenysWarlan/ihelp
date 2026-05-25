import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { CardPadding } from './card.model';

@Component({
  selector: 'ui-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"card card--" + padding()',
    '[class.card--hoverable]': 'hoverable()',
  },
})
export class CardComponent {
  readonly padding = input<CardPadding>('md');
  readonly hoverable = input<boolean>(false);
}

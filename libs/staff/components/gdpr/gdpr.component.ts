import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-gdpr',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent],
  templateUrl: './gdpr.component.html',
  styleUrl: './gdpr.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GdprComponent {}

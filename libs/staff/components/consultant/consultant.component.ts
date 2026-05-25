import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-consultant',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent, RouterLink],
  templateUrl: './consultant.component.html',
  styleUrl: './consultant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultantComponent {}

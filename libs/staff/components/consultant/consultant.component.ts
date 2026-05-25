import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-consultant',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './consultant.component.html',
  styleUrl: './consultant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultantComponent {}

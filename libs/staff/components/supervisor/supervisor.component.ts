import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-supervisor',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './supervisor.component.html',
  styleUrl: './supervisor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorComponent {}

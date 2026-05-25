import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-coordinator',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './coordinator.component.html',
  styleUrl: './coordinator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoordinatorComponent {}

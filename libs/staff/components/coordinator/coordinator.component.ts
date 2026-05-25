import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-coordinator',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent, RouterLink],
  templateUrl: './coordinator.component.html',
  styleUrl: './coordinator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoordinatorComponent {}

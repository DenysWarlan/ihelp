import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {}

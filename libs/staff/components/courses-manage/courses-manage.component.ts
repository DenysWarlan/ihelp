import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent } from '@org/shared/ui';

@Component({
  selector: 'app-courses-manage',
  standalone: true,
  imports: [TranslocoDirective, CardComponent],
  templateUrl: './courses-manage.component.html',
  styleUrl: './courses-manage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesManageComponent {}

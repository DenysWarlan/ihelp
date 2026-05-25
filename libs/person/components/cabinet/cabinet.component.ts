import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  CardComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [
    TranslocoDirective,
    CardComponent,
    IconComponent,
    ProgressBarComponent,
  ],
  templateUrl: './cabinet.component.html',
  styleUrl: './cabinet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);

  ngOnInit(): void {
    this.facade.loadDashboard();
  }
}

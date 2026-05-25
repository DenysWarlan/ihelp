import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  IconComponent,
} from '@org/shared/ui';
import { GdprFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-gdpr',
  standalone: true,
  imports: [
    DatePipe,
    TranslocoDirective,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
  ],
  templateUrl: './gdpr.component.html',
  styleUrl: './gdpr.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GdprComponent implements OnInit {
  readonly facade: GdprFacade = inject(GdprFacade);

  ngOnInit(): void {
    this.facade.loadAccessRequests();
  }
}

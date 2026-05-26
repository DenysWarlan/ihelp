import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  IconComponent,
} from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-person-meetings',
  standalone: true,
  imports: [
    TranslocoDirective,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
  ],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingsComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);

  ngOnInit(): void {
    this.facade.loadMeetings();
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'SCHEDULED':
        return 'info';
      case 'IN_PROGRESS':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

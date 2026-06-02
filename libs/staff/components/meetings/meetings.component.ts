import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, CardComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-staff-meetings',
  standalone: true,
  imports: [
    TranslocoDirective,
    CardComponent,
    BadgeComponent,
    DatePipe,
  ],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingsComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);
  private readonly router: Router = inject(Router);

  readonly meetings = this.facade.meetings;
  readonly isLoading = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadMeetings();
  }

  onScheduleMeeting(): void {
    this.router.navigate(['/staff/cases']);
  }

  getMeetingStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'SCHEDULED':
        return 'info';
      case 'IN_PROGRESS':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

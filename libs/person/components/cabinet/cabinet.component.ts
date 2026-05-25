import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import { PersonFacade, PersonMeeting } from '@org/person/data-access';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [
    DatePipe,
    TranslocoDirective,
    ButtonComponent,
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

  readonly nextMeeting: Signal<PersonMeeting | null> = computed(() => {
    const meetings = this.facade.meetings();
    const scheduled = meetings.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS');
    if (scheduled.length === 0) return null;
    return scheduled.reduce((closest, m) =>
      new Date(m.scheduledAt) < new Date(closest.scheduledAt) ? m : closest
    );
  });

  ngOnInit(): void {
    this.facade.loadDashboard();
    this.facade.loadCourses();
    this.facade.loadMeetings();
    this.facade.loadProfile();
  }

  onWriteConsultant(): void {
    // Navigate to chat - placeholder for now
  }
}

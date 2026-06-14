import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
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
    DatePipe,
  ],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingsComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);

  readonly isModalOpen: WritableSignal<boolean> = signal(false);
  readonly submitError: WritableSignal<string | null> = signal(null);
  readonly today: string = new Date().toISOString().split('T')[0];

  constructor() {
    effect(() => {
      if (this.facade.requestSuccess()) {
        this.closeModal();
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadMeetings();
    this.facade.loadDashboard();
  }

  openModal(): void {
    this.submitError.set(null);
    this.facade.resetMeetingRequest();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  onConfirm(id: string): void {
    this.facade.confirmMeeting(id);
  }

  onSubmitRequest(): void {
    const result = this.facade.submitMeetingRequest();
    this.submitError.set(result);
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'COMPLETED':
      case 'CONFIRMED':
        return 'success';
      case 'SCHEDULED':
        return 'info';
      case 'REQUESTED':
      case 'IN_PROGRESS':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

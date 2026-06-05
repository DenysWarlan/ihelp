import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ModalComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';
import type { CaseListItem, ScheduleMeetingFormModel } from '@org/staff/data-access';

@Component({
  selector: 'app-staff-meetings',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    DatePipe,
    FormsModule,
    ModalComponent,
  ],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingsComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);

  readonly meetings = this.facade.meetings;
  readonly cases = this.facade.cases;
  readonly isLoading = this.facade.isLoading;

  readonly isModalOpen: WritableSignal<boolean> = signal(false);
  readonly today: string = new Date().toLocaleDateString('en-CA');

  readonly formModel: WritableSignal<ScheduleMeetingFormModel> = signal({
    date: '',
    time: '',
    duration: '30',
    notes: '',
  });

  readonly selectedCaseId: WritableSignal<string> = signal('');
  readonly caseSearch: WritableSignal<string> = signal('');

  ngOnInit(): void {
    this.facade.loadMeetings();
    this.facade.loadCases();
  }

  readonly filteredCases: Signal<CaseListItem[]> = computed(() => {
    const q: string = this.caseSearch().toLowerCase();
    if (!q) return this.cases();
    return this.cases().filter(
      (c: CaseListItem) =>
        c.personName.toLowerCase().includes(q) ||
        c.topic.toLowerCase().includes(q),
    );
  });

  openModal(): void {
    this.formModel.set({ date: '', time: '', duration: '30', notes: '' });
    this.selectedCaseId.set('');
    this.caseSearch.set('');
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  selectCase(c: CaseListItem): void {
    this.selectedCaseId.set(c.id);
  }

  updateField(field: keyof ScheduleMeetingFormModel, value: string): void {
    this.formModel.update((current: ScheduleMeetingFormModel) => ({
      ...current,
      [field]: value,
    }));
  }

  readonly submitError: WritableSignal<string> = signal('');

  onSubmit(): void {
    const form: ScheduleMeetingFormModel = this.formModel();
    const caseId: string = this.selectedCaseId();
    if (!caseId || !form.date || !form.time) return;

    // Validate that the selected date+time is in the future
    const scheduled = new Date(`${form.date}T${form.time}`);
    if (scheduled <= new Date()) {
      this.submitError.set('Cannot schedule a meeting in the past');
      return;
    }

    this.submitError.set('');
    this.facade.scheduleMeeting({
      caseId,
      date: form.date,
      time: form.time,
      durationMinutes: parseInt(form.duration, 10),
      notes: form.notes,
    });
    this.closeModal();
  }

  getSelectedCaseName(): string {
    const id: string = this.selectedCaseId();
    if (!id) return '';
    const c: CaseListItem | undefined = this.cases().find((item: CaseListItem) => item.id === id);
    return c ? `${c.personName} — ${c.topic}` : '';
  }

  getMeetingStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'SCHEDULED':
      case 'CONFIRMED':
        return 'info';
      case 'IN_PROGRESS':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
      case 'NO_SHOW_PERSON':
      case 'NO_SHOW_CONSULTANT':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

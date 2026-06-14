import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ModalComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';
import type {
  CaseListItem,
  ScheduleMeetingFormModel,
  StaffUser,
  TeamMeeting,
  TeamMeetingFormModel,
  TeamParticipantStatus,
} from '@org/staff/data-access';

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
  readonly facade: StaffFacade = inject(StaffFacade);

  readonly meetings = this.facade.meetings;
  readonly cases = this.facade.cases;
  readonly isLoading = this.facade.isLoading;

  readonly teamMeetings: Signal<TeamMeeting[]> = this.facade.teamMeetings;
  readonly staffUsers: Signal<StaffUser[]> = this.facade.staffUsers;
  readonly teamModel: Signal<TeamMeetingFormModel> = this.facade.teamMeetingModel;

  readonly isTeamModalOpen: WritableSignal<boolean> = signal(false);
  readonly teamSubmitError: WritableSignal<string> = signal('');

  readonly cancelTeamId: WritableSignal<string | null> = signal(null);
  readonly cancelTeamReason: WritableSignal<string> = signal('');

  readonly isModalOpen: WritableSignal<boolean> = signal(false);
  readonly today: string = new Date().toLocaleDateString('en-CA');

  constructor() {
    effect(() => {
      if (this.facade.teamCreateSuccess()) {
        this.closeTeamModal();
      }
    });
  }

  readonly formModel: WritableSignal<ScheduleMeetingFormModel> = signal({
    date: '',
    time: '',
    duration: '30',
    notes: '',
  });

  readonly selectedCaseId: WritableSignal<string> = signal('');
  readonly caseSearch: WritableSignal<string> = signal('');

  readonly declineMeetingId: WritableSignal<string | null> = signal(null);
  readonly declineReason: WritableSignal<string> = signal('');

  ngOnInit(): void {
    this.facade.loadMeetings();
    this.facade.loadCases();
    this.facade.loadTeamMeetings();
    this.facade.loadStaffUsers();
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

  acceptMeeting(id: string): void {
    this.facade.acceptMeeting(id);
  }

  openDeclineModal(id: string): void {
    this.declineReason.set('');
    this.declineMeetingId.set(id);
  }

  closeDeclineModal(): void {
    this.declineMeetingId.set(null);
  }

  confirmDecline(): void {
    const id: string | null = this.declineMeetingId();
    if (!id) return;
    this.facade.declineMeeting(id, this.declineReason());
    this.closeDeclineModal();
  }

  getSelectedCaseName(): string {
    const id: string = this.selectedCaseId();
    if (!id) return '';
    const c: CaseListItem | undefined = this.cases().find((item: CaseListItem) => item.id === id);
    return c ? `${c.personName} — ${c.topic}` : '';
  }

  // ---------------------------------------------------------------------------
  // Team meetings
  // ---------------------------------------------------------------------------

  openTeamModal(): void {
    this.teamSubmitError.set('');
    this.facade.resetTeamMeeting();
    this.isTeamModalOpen.set(true);
  }

  closeTeamModal(): void {
    this.isTeamModalOpen.set(false);
  }

  updateTeamField(field: 'title' | 'date' | 'time' | 'duration' | 'notes', value: string): void {
    this.facade.updateTeamMeetingField(field, value);
  }

  toggleParticipant(userId: string): void {
    this.facade.toggleParticipant(userId);
  }

  isParticipantSelected(userId: string): boolean {
    return this.teamModel().participantIds.includes(userId);
  }

  onSubmitTeam(): void {
    const error: string | null = this.facade.submitTeamMeeting();
    this.teamSubmitError.set(error ?? '');
  }

  onAcceptTeam(id: string): void {
    this.facade.acceptTeamMeeting(id);
  }

  onDeclineTeam(id: string): void {
    this.facade.declineTeamMeeting(id);
  }

  openCancelTeamModal(id: string): void {
    this.cancelTeamReason.set('');
    this.cancelTeamId.set(id);
  }

  closeCancelTeamModal(): void {
    this.cancelTeamId.set(null);
  }

  confirmCancelTeam(): void {
    const id: string | null = this.cancelTeamId();
    if (!id) return;
    this.facade.cancelTeamMeeting(id, this.cancelTeamReason());
    this.closeCancelTeamModal();
  }

  getTeamStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'SCHEDULED':
        return 'info';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  }

  getParticipantStatusVariant(status: TeamParticipantStatus): BadgeVariant {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'DECLINED':
        return 'error';
      case 'INVITED':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  getMeetingStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'SCHEDULED':
        return 'info';
      case 'REQUESTED':
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

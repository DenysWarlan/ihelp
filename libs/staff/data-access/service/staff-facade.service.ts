import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';

import {
  CaseDetail,
  CaseListItem,
  CreateTeamMeetingPayload,
  ScheduleMeetingRequest,
  StaffDashboard,
  StaffMeeting,
  StaffUser,
  TeamMeeting,
  TeamMeetingFormModel,
} from '../model/staff.model';
import { StaffStore } from '../store/staff.store';

const DEFAULT_TEAM_MEETING_FORM: TeamMeetingFormModel = {
  title: '',
  date: '',
  time: '',
  duration: '60',
  participantIds: [],
  notes: '',
};

@Injectable({ providedIn: 'root' })
export class StaffFacade {
  private readonly store = inject(StaffStore);
  private readonly router: Router = inject(Router);

  readonly dashboard: Signal<StaffDashboard | null> = this.store.dashboard;
  readonly cases: Signal<CaseListItem[]> = this.store.cases;
  readonly selectedCase: Signal<CaseDetail | null> = this.store.selectedCase;
  readonly meetings: Signal<StaffMeeting[]> = this.store.meetings;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  readonly teamMeetings: Signal<TeamMeeting[]> = this.store.teamMeetings;
  readonly staffUsers: Signal<StaffUser[]> = this.store.staffUsers;
  readonly teamCreateSuccess: Signal<boolean> = this.store.teamCreateSuccess;

  readonly teamMeetingModel: WritableSignal<TeamMeetingFormModel> = signal(
    DEFAULT_TEAM_MEETING_FORM,
  );

  loadDashboard(): void {
    this.store.loadDashboard();
  }

  loadCases(): void {
    this.store.loadCases();
  }

  loadCaseDetail(id: string): void {
    this.store.loadCaseDetail(id);
  }

  loadMeetings(): void {
    this.store.loadMeetings();
  }

  sendCaseMessage(caseId: string, content: string): void {
    this.store.sendCaseMessage({ caseId, content });
  }

  addCaseNote(caseId: string, content: string, isInternal: boolean): void {
    this.store.addCaseNote({ caseId, content, isInternal });
  }

  scheduleMeeting(data: ScheduleMeetingRequest): void {
    this.store.scheduleMeeting(data);
  }

  completeCase(caseId: string, version: number): void {
    this.store.completeCase({ caseId, version });
  }

  reassignCase(caseId: string, consultantUserId: string): void {
    this.store.reassignCase({ caseId, consultantUserId });
  }

  acceptMeeting(id: string): void {
    this.store.acceptMeeting(id);
  }

  declineMeeting(id: string, reason: string): void {
    this.store.declineMeeting({ id, reason });
  }

  navigateToCase(id: string): void {
    this.router.navigate(['/staff/cases', id]);
  }

  // ---------------------------------------------------------------------------
  // Team meetings (internal staff / group meetings)
  // ---------------------------------------------------------------------------

  loadTeamMeetings(): void {
    this.store.loadTeamMeetings();
  }

  loadStaffUsers(): void {
    this.store.loadStaffUsers();
  }

  updateTeamMeetingField(
    field: keyof Omit<TeamMeetingFormModel, 'participantIds'>,
    value: string,
  ): void {
    this.teamMeetingModel.update((current: TeamMeetingFormModel) => ({
      ...current,
      [field]: value,
    }));
  }

  toggleParticipant(userId: string): void {
    this.teamMeetingModel.update((current: TeamMeetingFormModel) => {
      const exists: boolean = current.participantIds.includes(userId);
      const participantIds: string[] = exists
        ? current.participantIds.filter((id: string) => id !== userId)
        : [...current.participantIds, userId];
      return { ...current, participantIds };
    });
  }

  resetTeamMeeting(): void {
    this.teamMeetingModel.set(DEFAULT_TEAM_MEETING_FORM);
    this.store.resetTeamCreateSuccess();
  }

  /** Validates and submits the team meeting form. Returns an error code or null on success. */
  submitTeamMeeting(): string | null {
    const form: TeamMeetingFormModel = this.teamMeetingModel();

    if (!form.title.trim()) {
      return 'titleRequired';
    }

    if (!form.date || !form.time) {
      return 'dateRequired';
    }

    if (form.participantIds.length === 0) {
      return 'participantsRequired';
    }

    const scheduledAt = new Date(`${form.date}T${form.time}`);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      return 'future';
    }

    const payload: CreateTeamMeetingPayload = {
      title: form.title.trim(),
      scheduledAt: scheduledAt.toISOString(),
      participantIds: form.participantIds,
      durationMin: parseInt(form.duration, 10),
      notes: form.notes.trim() || undefined,
    };

    this.store.createTeamMeeting(payload);
    return null;
  }

  acceptTeamMeeting(id: string): void {
    this.store.respondTeamMeeting({ id, status: 'ACCEPTED' });
  }

  declineTeamMeeting(id: string): void {
    this.store.respondTeamMeeting({ id, status: 'DECLINED' });
  }

  cancelTeamMeeting(id: string, reason: string): void {
    this.store.cancelTeamMeeting({ id, reason });
  }
}

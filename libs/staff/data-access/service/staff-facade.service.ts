import { inject, Injectable, Signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  CaseDetail,
  CaseListItem,
  ScheduleMeetingRequest,
  StaffDashboard,
  StaffMeeting,
} from '../model/staff.model';
import { StaffStore } from '../store/staff.store';

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

  navigateToCase(id: string): void {
    this.router.navigate(['/staff/cases', id]);
  }
}

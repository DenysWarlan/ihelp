import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CaseDetail,
  CaseListItem,
  CaseNote,
  ScheduleMeetingRequest,
  StaffDashboard,
  StaffMeeting,
} from '../model/staff.model';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http: HttpClient = inject(HttpClient);

  getDashboard(): Observable<StaffDashboard> {
    return this.http.get<StaffDashboard>('/api/cases/dashboard');
  }

  getCases(): Observable<CaseListItem[]> {
    return this.http.get<CaseListItem[]>('/api/cases');
  }

  getCaseDetail(id: string): Observable<CaseDetail> {
    return this.http.get<CaseDetail>(`/api/cases/${id}`);
  }

  addNote(
    caseId: string,
    content: string,
    isInternal: boolean
  ): Observable<CaseNote> {
    return this.http.post<CaseNote>(`/api/cases/${caseId}/notes`, {
      content,
      isInternal,
    });
  }

  sendMessage(caseId: string, content: string): Observable<void> {
    return this.http.post<void>(`/api/cases/${caseId}/messages`, { content });
  }

  updateCaseStatus(id: string, status: string): Observable<void> {
    return this.http.patch<void>(`/api/cases/${id}/status`, { status });
  }

  getMeetings(): Observable<StaffMeeting[]> {
    return this.http.get<StaffMeeting[]>('/api/meetings/my');
  }

  scheduleMeeting(data: ScheduleMeetingRequest): Observable<StaffMeeting> {
    return this.http.post<StaffMeeting>(
      `/api/cases/${data.caseId}/meetings`,
      data
    );
  }
}

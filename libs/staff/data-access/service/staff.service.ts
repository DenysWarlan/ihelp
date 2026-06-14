import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CaseDetail,
  CaseListItem,
  CaseNote,
  CreateTeamMeetingPayload,
  ScheduleMeetingRequest,
  StaffDashboard,
  StaffMeeting,
  StaffUser,
  TeamMeeting,
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

  updateCaseStatus(id: string, status: string, version: number): Observable<void> {
    return this.http.patch<void>(`/api/cases/${id}/status`, { status, version });
  }

  getMeetings(): Observable<StaffMeeting[]> {
    return this.http.get<StaffMeeting[]>('/api/meetings/my');
  }

  scheduleMeeting(data: ScheduleMeetingRequest): Observable<StaffMeeting> {
    // Build a Date from local inputs to get the correct UTC ISO string
    const localDate = new Date(`${data.date}T${data.time}:00`);
    return this.http.post<StaffMeeting>(
      '/api/meetings',
      {
        careCaseId: data.caseId,
        scheduledAt: localDate.toISOString(),
        durationMin: data.durationMinutes,
        notes: data.notes || undefined,
      }
    );
  }

  acceptMeeting(id: string): Observable<StaffMeeting> {
    return this.http.patch<StaffMeeting>(`/api/meetings/${id}/accept`, {});
  }

  declineMeeting(id: string, cancelReason: string): Observable<StaffMeeting> {
    return this.http.patch<StaffMeeting>(`/api/meetings/${id}/decline`, { cancelReason });
  }

  reassignCase(caseId: string, consultantUserId: string): Observable<void> {
    return this.http.post<void>(`/api/assignment/${caseId}/reassign`, { consultantUserId });
  }

  getTeamMeetings(): Observable<TeamMeeting[]> {
    return this.http.get<TeamMeeting[]>('/api/team-meetings/my');
  }

  getStaffUsers(): Observable<StaffUser[]> {
    return this.http.get<StaffUser[]>('/api/team-meetings/staff');
  }

  createTeamMeeting(payload: CreateTeamMeetingPayload): Observable<TeamMeeting> {
    return this.http.post<TeamMeeting>('/api/team-meetings', payload);
  }

  respondTeamMeeting(id: string, status: 'ACCEPTED' | 'DECLINED'): Observable<TeamMeeting> {
    return this.http.patch<TeamMeeting>(`/api/team-meetings/${id}/respond`, { status });
  }

  cancelTeamMeeting(id: string, cancelReason: string): Observable<TeamMeeting> {
    return this.http.patch<TeamMeeting>(`/api/team-meetings/${id}/cancel`, { cancelReason });
  }
}

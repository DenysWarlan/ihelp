import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { CaseListItem } from '../model/staff.model';
import type {
  CrisisHistoryItem,
  TeamAnalytics,
  TeamMember,
  SupervisorCaseDetail,
} from '../model/supervisor.model';

@Injectable({ providedIn: 'root' })
export class SupervisorService {
  private readonly http: HttpClient = inject(HttpClient);

  getTeamAnalytics(): Observable<TeamAnalytics> {
    return this.http.get<TeamAnalytics>('/api/analytics/team');
  }

  getTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>('/api/analytics/team/members');
  }

  getAllCases(): Observable<CaseListItem[]> {
    return this.http.get<CaseListItem[]>('/api/supervisor/cases');
  }

  getCaseDetail(id: string): Observable<SupervisorCaseDetail> {
    return this.http.get<SupervisorCaseDetail>(
      `/api/supervisor/cases/${id}`
    );
  }

  addComment(caseId: string, comment: string): Observable<void> {
    return this.http.post<void>(
      `/api/supervisor/cases/${caseId}/comment`,
      { comment }
    );
  }

  getCrisisHistory(): Observable<CrisisHistoryItem[]> {
    return this.http.get<CrisisHistoryItem[]>('/api/supervisor/crisis-history');
  }
}

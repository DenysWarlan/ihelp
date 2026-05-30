import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  SlaOverview,
  WorkloadEntry,
  AssignmentSuggestion,
  CrisisAlert,
  ConsultantDetail,
} from '../model/coordinator.model';

@Injectable({ providedIn: 'root' })
export class CoordinatorService {
  private readonly http: HttpClient = inject(HttpClient);

  getSlaOverview(): Observable<SlaOverview> {
    return this.http.get<SlaOverview>('/api/sla/overview');
  }

  getWorkload(): Observable<WorkloadEntry[]> {
    return this.http.get<WorkloadEntry[]>('/api/workload');
  }

  getAssignmentSuggestions(): Observable<AssignmentSuggestion[]> {
    return this.http.get<AssignmentSuggestion[]>('/api/assignment/suggestions');
  }

  getCrisisAlerts(): Observable<CrisisAlert[]> {
    return this.http.get<CrisisAlert[]>('/api/crisis/alerts');
  }

  getConsultantCases(userId: string): Observable<ConsultantDetail> {
    return this.http.get<ConsultantDetail>(`/api/workload/consultants/${userId}/cases`);
  }

  confirmAssignment(caseId: string, consultantId: string): Observable<void> {
    return this.http.post<void>(`/api/assignment/${caseId}/confirm`, { consultantId });
  }

  rejectAssignment(caseId: string): Observable<void> {
    return this.http.post<void>(`/api/assignment/${caseId}/reject`, {});
  }

  acknowledgeCrisis(id: string): Observable<void> {
    return this.http.post<void>(`/api/crisis/alerts/${id}/acknowledge`, {});
  }
}

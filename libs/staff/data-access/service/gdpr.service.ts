import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  GdprAccessRequest,
  GdprRetentionPolicy,
  GdprSarKeyword,
  GdprAuditEntry,
  GdprAuditLogParams,
} from '../model/gdpr.model';

@Injectable({ providedIn: 'root' })
export class GdprService {
  private readonly http: HttpClient = inject(HttpClient);

  getAccessRequests(status?: string): Observable<GdprAccessRequest[]> {
    const params: Record<string, string> = {};
    if (status) {
      params['status'] = status;
    }
    return this.http.get<GdprAccessRequest[]>('/api/gdpr/access-requests', {
      params,
    });
  }

  approveRequest(id: string): Observable<GdprAccessRequest> {
    return this.http.post<GdprAccessRequest>(
      `/api/gdpr/access-requests/${id}/approve`,
      {}
    );
  }

  rejectRequest(id: string, reason?: string): Observable<GdprAccessRequest> {
    return this.http.post<GdprAccessRequest>(
      `/api/gdpr/access-requests/${id}/reject`,
      { reason }
    );
  }

  getRetentionPolicies(): Observable<GdprRetentionPolicy[]> {
    return this.http.get<GdprRetentionPolicy[]>('/api/gdpr/retention-policies');
  }

  getSarKeywords(): Observable<GdprSarKeyword[]> {
    return this.http.get<GdprSarKeyword[]>('/api/gdpr/sar-keywords');
  }

  getAuditLog(params?: GdprAuditLogParams): Observable<GdprAuditEntry[]> {
    const queryParams: Record<string, string> = {};
    if (params?.action) {
      queryParams['action'] = params.action;
    }
    if (params?.userId) {
      queryParams['userId'] = params.userId;
    }
    if (params?.from) {
      queryParams['from'] = params.from;
    }
    if (params?.to) {
      queryParams['to'] = params.to;
    }
    return this.http.get<GdprAuditEntry[]>('/api/gdpr/audit-log', {
      params: queryParams,
    });
  }
}

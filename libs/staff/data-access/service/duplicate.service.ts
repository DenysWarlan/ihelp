import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DuplicateGroup,
  DuplicateGroupsResponse,
  ExecuteMergeRequest,
  MergeExecutionResult,
  MergeHistoryResponse,
} from '../model/duplicate.model';

@Injectable({ providedIn: 'root' })
export class DuplicateService {
  private readonly http: HttpClient = inject(HttpClient);

  getGroups(confidence?: string): Observable<DuplicateGroupsResponse> {
    const params: Record<string, string> = {};
    if (confidence) {
      params['confidence'] = confidence;
    }
    return this.http.get<DuplicateGroupsResponse>('/api/admin/duplicates', {
      params,
    });
  }

  getGroupDetail(groupId: string): Observable<DuplicateGroup> {
    return this.http.get<DuplicateGroup>(`/api/admin/duplicates/${groupId}`);
  }

  dismissGroup(
    groupId: string,
    reason?: string,
  ): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      `/api/admin/duplicates/${groupId}/dismiss`,
      { reason },
    );
  }

  executeMerge(
    groupId: string,
    dto: ExecuteMergeRequest,
  ): Observable<MergeExecutionResult> {
    return this.http.post<MergeExecutionResult>(
      `/api/admin/duplicates/${groupId}/merge`,
      dto,
    );
  }

  getMergeHistory(
    page?: number,
    pageSize?: number,
  ): Observable<MergeHistoryResponse> {
    const params: Record<string, string> = {};
    if (page) {
      params['page'] = String(page);
    }
    if (pageSize) {
      params['pageSize'] = String(pageSize);
    }
    return this.http.get<MergeHistoryResponse>(
      '/api/admin/duplicates/history',
      { params },
    );
  }
}

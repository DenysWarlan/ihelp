import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AdminDashboardResponse,
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserRequest,
  CreateInviteRequest,
  UsersQueryParams,
  PaginatedUsersResponse,
  DuplicatesResponse,
} from '../model/admin.model';
import type { CaseListItem } from '../model/staff.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http: HttpClient = inject(HttpClient);

  getDashboard(): Observable<AdminDashboardResponse> {
    return this.http.get<AdminDashboardResponse>('/api/admin/dashboard');
  }

  getCases(): Observable<CaseListItem[]> {
    return this.http.get<CaseListItem[]>('/api/supervisor/cases');
  }

  getUsers(query: UsersQueryParams): Observable<PaginatedUsersResponse> {
    const params: Record<string, string> = {
      page: String(query.page),
      pageSize: String(query.pageSize),
    };
    if (query.search) {
      params['search'] = query.search;
    }
    if (query.role) {
      params['role'] = query.role;
    }
    return this.http.get<PaginatedUsersResponse>('/api/admin/users', { params });
  }

  createUser(dto: CreateUserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>('/api/admin/users', dto);
  }

  updateUser(id: string, dto: Partial<AdminUser>): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`/api/admin/users/${id}`, dto);
  }

  getDuplicates(): Observable<DuplicatesResponse> {
    return this.http.get<DuplicatesResponse>('/api/admin/users/duplicates');
  }

  deactivateUser(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/users/${id}`);
  }

  getInvites(
    params?: Record<string, string>
  ): Observable<{ data: AdminInvite[]; total: number }> {
    return this.http.get<{ data: AdminInvite[]; total: number }>(
      '/api/admin/invites',
      { params }
    );
  }

  createInvite(dto: CreateInviteRequest): Observable<AdminInvite> {
    return this.http.post<AdminInvite>('/api/admin/invites', dto);
  }

  revokeInvite(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/invites/${id}`);
  }

  getSettings(category: string): Observable<SystemSetting[]> {
    return this.http.get<SystemSetting[]>(`/api/admin/settings/${category}`);
  }

  updateSettings(
    category: string,
    settings: Record<string, string>
  ): Observable<void> {
    return this.http.patch<void>(`/api/admin/settings/${category}`, {
      settings,
    });
  }

  getAuditLog(
    params?: Record<string, string>
  ): Observable<{ data: AuditLogEntry[]; total: number }> {
    return this.http.get<{ data: AuditLogEntry[]; total: number }>(
      '/api/admin/audit-log',
      { params }
    );
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserRequest,
  CreateInviteRequest,
} from '../model/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http: HttpClient = inject(HttpClient);

  getUsers(
    params?: Record<string, string>
  ): Observable<{ data: AdminUser[]; total: number }> {
    return this.http.get<{ data: AdminUser[]; total: number }>(
      '/api/admin/users',
      { params }
    );
  }

  createUser(dto: CreateUserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>('/api/admin/users', dto);
  }

  updateUser(id: string, dto: Partial<AdminUser>): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`/api/admin/users/${id}`, dto);
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

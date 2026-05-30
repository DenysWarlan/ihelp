import { inject, Injectable, Signal, WritableSignal, signal } from '@angular/core';

import { AdminStore } from '../store/admin.store';
import {
  AdminDashboardStats,
  AdminDashboardAlerts,
  AdminDashboardAuditEntry,
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserFormModel,
  CreateInviteFormModel,
  EditUserFormModel,
  UsersQueryParams,
} from '../model/admin.model';
import type { SelectOption } from '@org/shared/ui';

@Injectable({ providedIn: 'root' })
export class AdminFacade {
  private readonly store = inject(AdminStore);

  readonly dashboardStats: Signal<AdminDashboardStats | null> = this.store.dashboardStats;
  readonly dashboardAlerts: Signal<AdminDashboardAlerts | null> = this.store.dashboardAlerts;
  readonly dashboardAudit: Signal<AdminDashboardAuditEntry[]> = this.store.dashboardAudit;
  readonly dashboardLoading: Signal<boolean> = this.store.dashboardLoading;

  readonly users: Signal<AdminUser[]> = this.store.users;
  readonly usersTotal: Signal<number> = this.store.usersTotal;
  readonly usersPage: Signal<number> = this.store.usersPage;
  readonly usersPageSize: Signal<number> = this.store.usersPageSize;
  readonly usersTotalPages: Signal<number> = this.store.usersTotalPages;
  readonly duplicatesCount: Signal<number> = this.store.duplicatesCount;
  readonly invites: Signal<AdminInvite[]> = this.store.invites;
  readonly invitesTotal: Signal<number> = this.store.invitesTotal;
  readonly auditLog: Signal<AuditLogEntry[]> = this.store.auditLog;
  readonly auditLogTotal: Signal<number> = this.store.auditLogTotal;
  readonly settings: Signal<SystemSetting[]> = this.store.settings;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  readonly showCreateUserModal: WritableSignal<boolean> = signal(false);
  readonly showCreateInviteModal: WritableSignal<boolean> = signal(false);
  readonly showEditUserModal: WritableSignal<boolean> = signal(false);
  readonly editingUser: WritableSignal<AdminUser | null> = signal(null);

  readonly editUserModel: WritableSignal<EditUserFormModel> = signal({
    name: '',
    role: '',
  });

  readonly createUserModel: WritableSignal<CreateUserFormModel> = signal({
    email: '',
    name: '',
    role: '',
    password: '',
  });

  readonly createInviteModel: WritableSignal<CreateInviteFormModel> = signal({
    email: '',
    role: '',
  });

  readonly roleOptions: SelectOption[] = [
    { value: 'CONSULTANT', label: 'Consultant' },
    { value: 'SUPERVISOR', label: 'Supervisor' },
    { value: 'COORDINATOR', label: 'Coordinator' },
    { value: 'ADMIN', label: 'Admin' },
  ];

  loadDashboard(): void {
    this.store.loadDashboard();
  }

  loadUsers(params?: Partial<UsersQueryParams>): void {
    const query: UsersQueryParams = {
      page: params?.page ?? this.store.usersPage(),
      pageSize: params?.pageSize ?? this.store.usersPageSize(),
      search: params?.search,
      role: params?.role,
    };
    this.store.loadUsers(query);
  }

  loadDuplicates(): void {
    this.store.loadDuplicates();
  }

  loadInvites(): void {
    this.store.loadInvites();
  }

  loadAuditLog(): void {
    this.store.loadAuditLog();
  }

  loadSettings(category: string): void {
    this.store.loadSettings(category);
  }

  openCreateUserModal(): void {
    this.createUserModel.set({ email: '', name: '', role: '', password: '' });
    this.showCreateUserModal.set(true);
  }

  closeCreateUserModal(): void {
    this.showCreateUserModal.set(false);
  }

  openCreateInviteModal(): void {
    this.createInviteModel.set({ email: '', role: '' });
    this.showCreateInviteModal.set(true);
  }

  closeCreateInviteModal(): void {
    this.showCreateInviteModal.set(false);
  }

  submitCreateUser(): void {
    const model: CreateUserFormModel = this.createUserModel();
    if (!model.email || !model.name || !model.role || !model.password) {
      return;
    }
    this.store.createUser(model);
    this.closeCreateUserModal();
  }

  submitCreateInvite(): void {
    const model: CreateInviteFormModel = this.createInviteModel();
    if (!model.email || !model.role) {
      return;
    }
    this.store.createInvite(model);
    this.closeCreateInviteModal();
  }

  updateCreateUserField(field: keyof CreateUserFormModel, value: string): void {
    this.createUserModel.update(
      (m: CreateUserFormModel) => ({ ...m, [field]: value })
    );
  }

  updateCreateInviteField(field: keyof CreateInviteFormModel, value: string): void {
    this.createInviteModel.update(
      (m: CreateInviteFormModel) => ({ ...m, [field]: value })
    );
  }

  openEditUserModal(user: AdminUser): void {
    this.editingUser.set(user);
    this.editUserModel.set({ name: user.name, role: user.role });
    this.showEditUserModal.set(true);
  }

  closeEditUserModal(): void {
    this.showEditUserModal.set(false);
    this.editingUser.set(null);
  }

  updateEditUserField(field: keyof EditUserFormModel, value: string): void {
    this.editUserModel.update(
      (m: EditUserFormModel) => ({ ...m, [field]: value }),
    );
  }

  submitEditUser(): void {
    const user: AdminUser | null = this.editingUser();
    const model: EditUserFormModel = this.editUserModel();
    if (!user || !model.name || !model.role) return;
    this.store.updateUser({ id: user.id, dto: model });
    this.closeEditUserModal();
  }

  toggleUserActive(user: AdminUser): void {
    this.store.toggleUserActive({ id: user.id, isActive: !user.isActive });
  }

  getRoleBadgeVariant(role: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    switch (role) {
      case 'ADMIN':
        return 'error';
      case 'COORDINATOR':
        return 'warning';
      case 'SUPERVISOR':
        return 'info';
      case 'CONSULTANT':
        return 'success';
      default:
        return 'neutral';
    }
  }

  getStatusBadgeVariant(isActive: boolean): 'success' | 'neutral' {
    return isActive ? 'success' : 'neutral';
  }

  getInviteStatusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'CLAIMED':
        return 'success';
      case 'EXPIRED':
        return 'neutral';
      case 'REVOKED':
        return 'error';
      default:
        return 'neutral';
    }
  }
}

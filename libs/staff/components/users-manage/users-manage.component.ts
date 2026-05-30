import { ChangeDetectionStrategy, Component, inject, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  AlertBannerComponent,
  BadgeComponent,
  ButtonComponent,
  IconComponent,
  InputComponent,
  ModalComponent,
  PaginationComponent,
  SelectComponent,
} from '@org/shared/ui';
import type { PageChangeEvent } from '@org/shared/ui';
import { AdminFacade, AdminUser } from '@org/staff/data-access';

@Component({
  selector: 'app-users-manage',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    AlertBannerComponent,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    InputComponent,
    ModalComponent,
    PaginationComponent,
    SelectComponent,
  ],
  templateUrl: './users-manage.component.html',
  styleUrl: './users-manage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersManageComponent implements OnInit {
  protected readonly facade: AdminFacade = inject(AdminFacade);
  private readonly router: Router = inject(Router);

  protected readonly searchQuery: WritableSignal<string> = signal('');
  protected readonly selectedRole: WritableSignal<string> = signal('ALL');
  protected readonly roleFilters: readonly string[] = ['ALL', 'PERSON', 'CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

  protected readonly users: Signal<AdminUser[]> = this.facade.users;

  ngOnInit(): void {
    this.facade.loadUsers({ page: 1 });
    this.facade.loadInvites();
    this.facade.loadDuplicates();
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.loadWithFilters(1);
  }

  protected onRoleFilterChange(role: string): void {
    this.selectedRole.set(role);
    this.loadWithFilters(1);
  }

  protected onPageChange(event: PageChangeEvent): void {
    this.loadWithFilters(event.page);
  }

  protected onCreateUser(): void {
    this.facade.openCreateUserModal();
  }

  protected onCreateInvite(): void {
    this.facade.openCreateInviteModal();
  }

  protected onCloseCreateUser(): void {
    this.facade.closeCreateUserModal();
  }

  protected onCloseCreateInvite(): void {
    this.facade.closeCreateInviteModal();
  }

  protected onSubmitCreateUser(): void {
    this.facade.submitCreateUser();
  }

  protected onSubmitCreateInvite(): void {
    this.facade.submitCreateInvite();
  }

  protected onUserFieldChange(field: 'email' | 'name' | 'role' | 'password', value: string): void {
    this.facade.updateCreateUserField(field, value);
  }

  protected onInviteFieldChange(field: 'email' | 'role', value: string): void {
    this.facade.updateCreateInviteField(field, value);
  }

  protected onEditUser(user: AdminUser): void {
    this.facade.openEditUserModal(user);
  }

  protected onCloseEditUser(): void {
    this.facade.closeEditUserModal();
  }

  protected onSubmitEditUser(): void {
    this.facade.submitEditUser();
  }

  protected onEditUserFieldChange(field: 'name' | 'role', value: string): void {
    this.facade.updateEditUserField(field, value);
  }

  protected onToggleActive(user: AdminUser): void {
    this.facade.toggleUserActive(user);
  }

  protected onReviewDuplicates(): void {
    this.router.navigate(['/staff/duplicates']);
  }

  private loadWithFilters(page: number): void {
    const role: string = this.selectedRole();
    this.facade.loadUsers({
      page,
      search: this.searchQuery() || undefined,
      role: role === 'ALL' ? undefined : role,
    });
  }
}

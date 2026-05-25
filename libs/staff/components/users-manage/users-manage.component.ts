import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  AlertBannerComponent,
  BadgeComponent,
  ButtonComponent,
  IconComponent,
  InputComponent,
  ModalComponent,
  SelectComponent,
} from '@org/shared/ui';
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
    SelectComponent,
  ],
  templateUrl: './users-manage.component.html',
  styleUrl: './users-manage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersManageComponent implements OnInit {
  protected readonly facade: AdminFacade = inject(AdminFacade);

  protected readonly searchQuery: WritableSignal<string> = signal('');
  protected readonly selectedRole: WritableSignal<string> = signal('ALL');
  protected readonly roleFilters: readonly string[] = ['ALL', 'Consultant', 'Supervisor', 'Coordinator', 'Admin'] as const;

  protected readonly filteredUsers: Signal<AdminUser[]> = computed(() => {
    const users: AdminUser[] = this.facade.users();
    const query: string = this.searchQuery().toLowerCase();
    const role: string = this.selectedRole();

    return users.filter((user: AdminUser) => {
      const matchesSearch: boolean = !query
        || user.name.toLowerCase().includes(query)
        || user.email.toLowerCase().includes(query);
      const matchesRole: boolean = role === 'ALL' || user.role === role;
      return matchesSearch && matchesRole;
    });
  });

  ngOnInit(): void {
    this.facade.loadUsers();
    this.facade.loadInvites();
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  protected onRoleFilterChange(role: string): void {
    this.selectedRole.set(role);
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
}

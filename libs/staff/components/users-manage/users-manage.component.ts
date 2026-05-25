import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  InputComponent,
  ModalComponent,
  SelectComponent,
} from '@org/shared/ui';
import { AdminFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-users-manage',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    DatePipe,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
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

  ngOnInit(): void {
    this.facade.loadUsers();
    this.facade.loadInvites();
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

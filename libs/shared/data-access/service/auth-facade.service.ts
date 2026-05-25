import {
  inject,
  Injectable,
  Signal,
  WritableSignal,
  signal,
} from '@angular/core';
import { AuthStore } from '../store/auth.store';
import { StaffLoginRequest } from '../model/auth.model';

export interface StaffLoginFormModel {
  email: string;
  password: string;
  mfaCode: string;
}

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly store = inject(AuthStore);

  readonly loginForm: WritableSignal<StaffLoginFormModel> = signal({
    email: '',
    password: '',
    mfaCode: '',
  });

  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;
  readonly mfaRequired: Signal<boolean> = this.store.mfaRequired;

  updateField(field: keyof StaffLoginFormModel, value: string): void {
    this.loginForm.update((form) => ({ ...form, [field]: value }));
  }

  submitLogin(): void {
    const form = this.loginForm();
    const request: StaffLoginRequest = {
      email: form.email,
      password: form.password,
      ...(form.mfaCode ? { mfaCode: form.mfaCode } : {}),
    };
    this.store.staffLogin(request);
  }

  logout(): void {
    this.store.logout();
  }

  clearError(): void {
    this.store.clearError();
  }
}

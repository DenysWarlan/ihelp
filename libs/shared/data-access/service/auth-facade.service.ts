import {
  inject,
  Injectable,
  Signal,
  WritableSignal,
  signal,
} from '@angular/core';
import { AuthStore } from '../store/auth.store';
import {
  PersonLoginRequest,
  PersonRegisterRequest,
  PhoneLoginRequest,
  StaffLoginRequest,
} from '../model/auth.model';

export interface StaffLoginFormModel {
  email: string;
  password: string;
  mfaCode: string;
}

export interface PersonLoginFormModel {
  email: string;
  password: string;
}

export interface PhoneLoginFormModel {
  phone: string;
  password: string;
}

export interface RegisterFormModel {
  name: string;
  email: string;
  phone: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly store = inject(AuthStore);

  readonly loginForm: WritableSignal<StaffLoginFormModel> = signal({
    email: '',
    password: '',
    mfaCode: '',
  });

  readonly personLoginForm: WritableSignal<PersonLoginFormModel> = signal({
    email: '',
    password: '',
  });

  readonly phoneLoginForm: WritableSignal<PhoneLoginFormModel> = signal({
    phone: '',
    password: '',
  });

  readonly registerForm: WritableSignal<RegisterFormModel> = signal({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;
  readonly mfaRequired: Signal<boolean> = this.store.mfaRequired;

  updateField(field: keyof StaffLoginFormModel, value: string): void {
    this.loginForm.update((form) => ({ ...form, [field]: value }));
  }

  updatePersonField(field: keyof PersonLoginFormModel, value: string): void {
    this.personLoginForm.update((form) => ({ ...form, [field]: value }));
  }

  updatePhoneLoginField(field: keyof PhoneLoginFormModel, value: string): void {
    this.phoneLoginForm.update((form) => ({ ...form, [field]: value }));
  }

  updateRegisterField(field: keyof RegisterFormModel, value: string): void {
    this.registerForm.update((form) => ({ ...form, [field]: value }));
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

  submitPersonLogin(): void {
    const form = this.personLoginForm();
    const request: PersonLoginRequest = {
      email: form.email,
      password: form.password,
    };
    this.store.personLogin(request);
  }

  submitPhoneLogin(): void {
    const form = this.phoneLoginForm();
    const request: PhoneLoginRequest = {
      phone: form.phone,
      password: form.password,
    };
    this.store.personLoginByPhone(request);
  }

  submitRegister(): void {
    const form = this.registerForm();
    const request: PersonRegisterRequest = {
      name: form.name,
      password: form.password,
      ...(form.email ? { email: form.email } : {}),
      ...(form.phone ? { phone: form.phone } : {}),
    };
    this.store.personRegister(request);
  }

  logout(): void {
    this.store.logout();
  }

  resetForms(): void {
    this.personLoginForm.set({ email: '', password: '' });
    this.phoneLoginForm.set({ phone: '', password: '' });
    this.registerForm.set({ name: '', email: '', phone: '', password: '' });
  }

  clearError(): void {
    this.store.clearError();
  }
}

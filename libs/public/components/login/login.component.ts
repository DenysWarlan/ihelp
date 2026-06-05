import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  InputComponent,
  ButtonComponent,
  IconComponent,
  AlertBannerComponent,
} from '@org/shared/ui';
import { AuthFacade } from '@org/shared/data-access';

type LoginMode = 'email' | 'phone';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    RouterLink,
    InputComponent,
    ButtonComponent,
    IconComponent,
    AlertBannerComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  readonly facade: AuthFacade = inject(AuthFacade);

  readonly oauthError = signal<string | null>(null);
  readonly loginMode = signal<LoginMode>('email');

  readonly email = signal('');
  readonly phone = signal('');
  readonly password = signal('');

  constructor() {
    const params = this.route.snapshot.queryParams;
    if (params['error']) {
      this.oauthError.set(params['error']);
    }
  }

  setMode(mode: LoginMode): void {
    this.loginMode.set(mode);
    this.facade.clearError();
  }

  readonly isSubmitDisabled = computed(() => {
    if (this.loginMode() === 'email') {
      return !this.email() || !this.password();
    }
    return !this.phone() || !this.password();
  });

  onSubmit(): void {
    if (this.loginMode() === 'email') {
      this.facade.updatePersonField('email', this.email());
      this.facade.updatePersonField('password', this.password());
      this.facade.submitPersonLogin();
    } else {
      this.facade.updatePhoneLoginField('phone', this.phone());
      this.facade.updatePhoneLoginField('password', this.password());
      this.facade.submitPhoneLogin();
    }
  }

  loginWith(provider: 'google' | 'facebook' | 'telegram'): void {
    this.oauthError.set(null);
    this.facade.clearError();
    const win = this.doc.defaultView;
    if (win) {
      win.location.href = `/api/auth/${provider}`;
    }
  }

  retryOauth(): void {
    this.oauthError.set(null);
  }
}

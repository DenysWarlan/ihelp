import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  InputComponent,
  ButtonComponent,
  IconComponent,
  AlertBannerComponent,
} from '@org/shared/ui';
import { AuthFacade } from '@org/shared/data-access';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
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

  email = '';
  password = '';

  constructor() {
    const params = this.route.snapshot.queryParams;
    if (params['error']) {
      this.oauthError.set(params['error']);
    }
  }

  onSubmit(): void {
    this.facade.updatePersonField('email', this.email);
    this.facade.updatePersonField('password', this.password);
    this.facade.submitPersonLogin();
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

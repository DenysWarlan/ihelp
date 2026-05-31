import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
import { catchError, EMPTY } from 'rxjs';

import { ButtonComponent, InputComponent } from '@org/shared/ui';

@Component({
  selector: 'app-invite-claim',
  standalone: true,
  imports: [FormsModule, TranslocoModule, ButtonComponent, InputComponent],
  templateUrl: './invite-claim.component.html',
  styleUrls: ['./invite-claim.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteClaimComponent {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  readonly token = signal('');
  readonly name = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  constructor() {
    const win = this.document.defaultView;
    const params = new URLSearchParams(win?.location.search ?? '');
    this.token.set(params.get('token') ?? '');
  }

  onSubmit(): void {
    this.error.set(null);

    if (!this.token()) {
      this.error.set('Токен запрошення відсутній');
      return;
    }
    if (!this.name().trim()) {
      this.error.set("Введіть ваше ім'я");
      return;
    }
    if (this.password().length < 12) {
      this.error.set('Пароль має містити мінімум 12 символів');
      return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.error.set('Паролі не збігаються');
      return;
    }

    this.isLoading.set(true);

    this.http
      .post('/api/auth/invite/claim', {
        token: this.token(),
        name: this.name().trim(),
        password: this.password(),
      })
      .pipe(
        catchError((err) => {
          const msg =
            err.error?.message ?? 'Не вдалося створити акаунт';
          this.error.set(msg);
          this.isLoading.set(false);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.isLoading.set(false);
        this.success.set(true);
      });
  }

  goToLogin(): void {
    this.router.navigate(['/staff/login']);
  }
}

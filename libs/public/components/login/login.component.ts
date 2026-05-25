import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [TranslocoDirective, IconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);

  readonly errorMessage = signal<string | null>(null);

  constructor() {
    const params = this.route.snapshot.queryParams;
    if (params['error']) {
      this.errorMessage.set(params['error']);
    }
  }

  loginWith(provider: 'google' | 'facebook' | 'telegram'): void {
    this.errorMessage.set(null);
    const win = this.doc.defaultView;
    if (win) {
      win.location.href = `/api/auth/${provider}`;
    }
  }

  retry(): void {
    this.errorMessage.set(null);
  }
}

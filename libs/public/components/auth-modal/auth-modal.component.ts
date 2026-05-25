import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent, ModalComponent } from '@org/shared/ui';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [TranslocoDirective, ModalComponent, IconComponent],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly courseId = input<string>('');

  readonly closed = output<void>();

  readonly consentChecked = signal<boolean>(false);

  private readonly doc = inject(DOCUMENT);

  toggleConsent(): void {
    this.consentChecked.update((v) => !v);
  }

  onConsentKeydown(event: { key: string; preventDefault: () => void }): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggleConsent();
    }
  }

  loginWith(provider: 'google' | 'facebook' | 'telegram'): void {
    if (!this.consentChecked()) {
      return;
    }

    const win = this.doc.defaultView;
    if (win) {
      const courseId = this.courseId();
      const returnUrl = courseId ? `/person/courses` : '/person';
      win.location.href = `/api/auth/${provider}?returnUrl=${encodeURIComponent(returnUrl)}`;
    }
  }

  onClose(): void {
    this.consentChecked.set(false);
    this.closed.emit();
  }
}

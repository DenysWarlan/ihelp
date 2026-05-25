import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '@org/shared/ui';
import { CasesService, CreateCaseRequest } from '@org/public/data-access';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize } from 'rxjs';

type ContactMethod = 'email' | 'telegram' | 'phone';

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-need-help',
  standalone: true,
  imports: [TranslocoDirective, IconComponent, FormsModule, RouterLink],
  templateUrl: './need-help.component.html',
  styleUrl: './need-help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeedHelpComponent {
  private readonly casesService: CasesService = inject(CasesService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly name = signal('');
  readonly country = signal('');
  readonly language = signal('');
  readonly contactMethod = signal<ContactMethod>('email');
  readonly contactValue = signal('');
  readonly topic = signal('');
  readonly message = signal('');
  readonly consentData = signal(false);
  readonly consentSensitive = signal(false);
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly emailTouched = signal(false);

  readonly emailInvalid: Signal<boolean> = computed(() => {
    if (this.contactMethod() !== 'email') {
      return false;
    }
    if (!this.emailTouched()) {
      return false;
    }
    const value = this.contactValue();
    return value.length > 0 && !EMAIL_PATTERN.test(value);
  });

  readonly canSubmit: Signal<boolean> = computed(() => {
    const hasName = this.name().trim().length > 0;
    const hasContact = this.contactValue().trim().length > 0;
    const hasConsent = this.consentData();
    const notLoading = !this.loading();
    const emailValid = this.contactMethod() !== 'email' || EMAIL_PATTERN.test(this.contactValue());
    return hasName && hasContact && hasConsent && notLoading && emailValid;
  });

  selectContactMethod(method: ContactMethod): void {
    this.contactMethod.set(method);
    this.emailTouched.set(false);
  }

  onContactBlur(): void {
    if (this.contactMethod() === 'email') {
      this.emailTouched.set(true);
    }
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    const sensitiveConsent = this.consentSensitive();

    const request: CreateCaseRequest = {
      name: this.name().trim(),
      country: this.country(),
      language: this.language(),
      contactMethod: this.contactMethod(),
      contactValue: this.contactValue().trim(),
      topic: sensitiveConsent ? this.topic() : '',
      message: sensitiveConsent ? this.message().trim() : '',
      consentData: this.consentData(),
      consentSensitive: sensitiveConsent,
    };

    this.casesService
      .create(request)
      .pipe(
        catchError(() => {
          this.error.set('needHelp.submitError');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.submitted.set(true);
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize } from 'rxjs';

import { IconComponent } from '@org/shared/ui';
import { CasesService, CreateCaseRequest } from '@org/public/data-access';
import { PersonFacade } from '@org/person/data-access';

@Component({
  selector: 'app-request-help',
  standalone: true,
  imports: [TranslocoDirective, IconComponent, FormsModule],
  templateUrl: './request-help.component.html',
  styleUrl: './request-help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestHelpComponent implements OnInit {
  private readonly casesService: CasesService = inject(CasesService);
  private readonly facade: PersonFacade = inject(PersonFacade);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly country = signal('');
  readonly language = signal('');
  readonly topic = signal('');
  readonly message = signal('');
  readonly consentSensitive = signal(false);
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly hasConsultant: Signal<boolean> = computed(() => {
    return !!this.facade.dashboard()?.consultantName;
  });

  readonly canSubmit: Signal<boolean> = computed(() => {
    return !this.loading();
  });

  constructor() {
    effect(() => {
      if (this.hasConsultant()) {
        this.router.navigate(['/person/chat']);
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadProfile();
    this.facade.loadDashboard();
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      return;
    }

    const profile = this.facade.profile();
    if (!profile) {
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    const sensitiveConsent = this.consentSensitive();

    const request: CreateCaseRequest = {
      name: profile.name,
      country: this.country(),
      language: this.language(),
      contactMethod: 'email',
      contactValue: profile.email,
      topic: sensitiveConsent ? this.topic() : '',
      message: sensitiveConsent ? this.message().trim() : '',
      consentData: true,
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.submitted.set(true);
      });
  }

  onBack(): void {
    this.router.navigate(['/person']);
  }

  onGoToChat(): void {
    this.router.navigate(['/person/chat']);
  }

  onGoToCourses(): void {
    this.router.navigate(['/person/courses']);
  }
}

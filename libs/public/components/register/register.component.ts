import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  InputComponent,
  ButtonComponent,
  IconComponent,
  AlertBannerComponent,
} from '@org/shared/ui';
import { AuthFacade } from '@org/shared/data-access';

type IdentifierMode = 'email' | 'phone';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  readonly facade: AuthFacade = inject(AuthFacade);
  readonly identifierMode = signal<IdentifierMode>('email');

  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly password = signal('');

  readonly isSubmitDisabled = computed(() => {
    if (!this.name() || !this.password()) return true;
    if (this.identifierMode() === 'email') return !this.email();
    return !this.phone();
  });

  setMode(mode: IdentifierMode): void {
    this.identifierMode.set(mode);
    this.facade.clearError();
  }

  onSubmit(): void {
    this.facade.updateRegisterField('name', this.name());
    this.facade.updateRegisterField('password', this.password());
    if (this.identifierMode() === 'email') {
      this.facade.updateRegisterField('email', this.email());
      this.facade.updateRegisterField('phone', '');
    } else {
      this.facade.updateRegisterField('phone', this.phone());
      this.facade.updateRegisterField('email', '');
    }
    this.facade.submitRegister();
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  InputComponent,
  ButtonComponent,
  IconComponent,
  AlertBannerComponent,
} from '@org/shared/ui';
import { AuthFacade } from '@org/shared/data-access';

@Component({
  selector: 'app-staff-login',
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
  templateUrl: './staff-login.component.html',
  styleUrl: './staff-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffLoginComponent {
  readonly facade: AuthFacade = inject(AuthFacade);

  email = '';
  password = '';
  mfaCode = '';

  onSubmit(): void {
    this.facade.updateField('email', this.email);
    this.facade.updateField('password', this.password);
    if (this.mfaCode) {
      this.facade.updateField('mfaCode', this.mfaCode);
    }
    this.facade.submitLogin();
  }
}

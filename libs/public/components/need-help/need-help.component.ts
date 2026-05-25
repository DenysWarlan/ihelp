import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '@org/shared/ui';

type ContactMethod = 'email' | 'telegram' | 'phone';

@Component({
  selector: 'app-need-help',
  standalone: true,
  imports: [TranslocoDirective, IconComponent, FormsModule, RouterLink],
  templateUrl: './need-help.component.html',
  styleUrl: './need-help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeedHelpComponent {
  readonly name = signal('');
  readonly country = signal('');
  readonly language = signal('');
  readonly contactMethod = signal<ContactMethod>('email');
  readonly contactValue = signal('');
  readonly topic = signal('');
  readonly message = signal('');
  readonly consentData = signal(false);
  readonly consentProcessing = signal(false);
  readonly submitted = signal(false);

  selectContactMethod(method: ContactMethod): void {
    this.contactMethod.set(method);
  }

  onSubmit(): void {
    this.submitted.set(true);
  }
}

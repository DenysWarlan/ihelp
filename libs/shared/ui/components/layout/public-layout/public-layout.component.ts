import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '../../icon/icon.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, IconComponent, TranslocoDirective],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent {
  private readonly doc = inject(DOCUMENT);

  readonly mobileMenuOpen = signal(false);
  readonly isAuthenticated = signal(false);
  readonly userInitials = signal('');

  constructor() {
    const win = this.doc.defaultView;
    const token = win?.localStorage.getItem('ihelp_token');
    if (token) {
      this.isAuthenticated.set(true);
      const name = win?.localStorage.getItem('ihelp_user_name') ?? '';
      this.userInitials.set(
        name
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'U'
      );
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}

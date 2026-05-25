import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '../../icon/icon.component';
import { SIDEBAR_NAV_ITEMS } from './sidebar-nav.const';
import { SidebarNavItem, UserRole } from './sidebar-nav.model';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, TranslocoDirective],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent {
  private readonly doc = inject(DOCUMENT);

  readonly sidebarOpen = signal(false);
  readonly userRole = signal<UserRole>('person');
  readonly userInitials = signal('КО');

  readonly navItems = computed<readonly SidebarNavItem[]>(() => {
    const role = this.userRole();
    return SIDEBAR_NAV_ITEMS.filter((item) => item.roles.includes(role));
  });

  constructor() {
    const win = this.doc.defaultView;
    const role = win?.localStorage.getItem('ihelp_user_role') as UserRole | null;
    if (role) {
      this.userRole.set(role);
    }
    const name = win?.localStorage.getItem('ihelp_user_name') ?? '';
    if (name) {
      this.userInitials.set(
        name
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      );
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}

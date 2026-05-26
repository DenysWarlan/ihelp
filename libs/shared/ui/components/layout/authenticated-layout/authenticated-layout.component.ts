import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { ChatSocketService, NavBadgeService, NotificationSoundService } from '@org/shared/data-access';
import { IconComponent } from '../../icon/icon.component';
import { ToastContainerComponent } from '../../toast/toast.component';
import { ToastService } from '../../toast/toast.service';
import { SIDEBAR_NAV_ITEMS } from './sidebar-nav.const';
import { SidebarNavItem, UserRole } from './sidebar-nav.model';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, TranslocoDirective, ToastContainerComponent],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent implements OnInit {
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly navBadgeService = inject(NavBadgeService);
  private readonly socketService = inject(ChatSocketService);
  private readonly toastService = inject(ToastService);
  private readonly soundService = inject(NotificationSoundService);

  readonly chatUnreadCount: Signal<number> = this.navBadgeService.chatUnreadCount;

  readonly sidebarOpen = signal(false);
  readonly userRole = signal<UserRole>('person');
  readonly userName = signal('');
  readonly userEmail = signal('');
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
      this.userName.set(name);
      this.userInitials.set(
        name
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      );
    }
    const email = win?.localStorage.getItem('ihelp_user_email') ?? '';
    if (email) {
      this.userEmail.set(email);
    }
  }

  ngOnInit(): void {
    // Connect WebSocket early so we receive notifications on any page
    this.socketService.connect();

    this.socketService.notify$.subscribe((notification) => {
      // Increment unread badge
      this.navBadgeService.setChatUnreadCount(
        this.navBadgeService.chatUnreadCount() + 1,
      );
      // Show toast
      this.toastService.show(notification.preview || '...', {
        title: notification.senderName,
        variant: 'info',
        duration: 5000,
      });
      // Play sound
      this.soundService.play();
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  isExactRoute(route: string): boolean {
    return route === '/person' || route === '/staff';
  }

  logout(): void {
    this.socketService.disconnect();
    const win = this.doc.defaultView;
    const role = win?.localStorage.getItem('ihelp_user_role') ?? '';
    const staffRoles = ['consultant', 'supervisor', 'coordinator', 'admin'];
    const redirectPath = staffRoles.includes(role) ? '/staff/login' : '/login';
    if (win) {
      win.localStorage.removeItem('ihelp_token');
      win.localStorage.removeItem('ihelp_refresh_token');
      win.localStorage.removeItem('ihelp_user_role');
      win.localStorage.removeItem('ihelp_user_name');
      win.localStorage.removeItem('ihelp_user_email');
    }
    this.router.navigate([redirectPath]);
  }
}

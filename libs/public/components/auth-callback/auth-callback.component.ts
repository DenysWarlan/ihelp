import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: '<p>Авторизація...</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    const params = this.route.snapshot.queryParams;
    const accessToken = params['accessToken'];
    const refreshToken = params['refreshToken'];
    const win = this.doc.defaultView;

    if (accessToken && win) {
      win.localStorage.setItem('ihelp_token', accessToken);
      if (refreshToken) {
        win.localStorage.setItem('ihelp_refresh_token', refreshToken);
      }

      // Decode JWT to get user info
      try {
        const base64Url = accessToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const raw = (globalThis as unknown as { atob(s: string): string }).atob(base64);
        const bytes = Uint8Array.from({ length: raw.length }, (_, i) => raw.charCodeAt(i));
        const TD = (globalThis as unknown as { TextDecoder: new () => { decode(b: Uint8Array): string } }).TextDecoder;
        const payload = JSON.parse(new TD().decode(bytes));
        if (payload.email) {
          win.localStorage.setItem('ihelp_user_email', payload.email);
          win.localStorage.setItem('ihelp_user_name', payload.name ?? payload.email.split('@')[0]);
        }
        if (payload.role) {
          win.localStorage.setItem('ihelp_user_role', payload.role.toLowerCase());
        }
      } catch {
        // ignore decode errors
      }

      const pendingCourse = win.localStorage.getItem('ihelp_pending_course');
      if (pendingCourse) {
        win.localStorage.removeItem('ihelp_pending_course');
        this.router.navigate(['/person/courses', pendingCourse], {
          queryParams: { autostart: '1' },
        });
      } else {
        const role = win.localStorage.getItem('ihelp_user_role');
        const staffRoles = ['consultant', 'supervisor', 'coordinator', 'admin'];
        const redirectPath = role && staffRoles.includes(role) ? '/staff' : '/person';
        this.router.navigate([redirectPath]);
      }
    } else {
      this.router.navigate(['/login']);
    }
  }
}

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
        const payload = JSON.parse(win.atob(accessToken.split('.')[1]));
        if (payload.email) {
          win.localStorage.setItem('ihelp_user_name', payload.email.split('@')[0]);
        }
        if (payload.role) {
          win.localStorage.setItem('ihelp_user_role', payload.role.toLowerCase());
        }
      } catch {
        // ignore decode errors
      }

      const role = win.localStorage.getItem('ihelp_user_role');
      const staffRoles = ['consultant', 'supervisor', 'coordinator', 'admin'];
      const redirectPath = role && staffRoles.includes(role) ? '/staff' : '/person';
      this.router.navigate([redirectPath]);
    } else {
      this.router.navigate(['/login']);
    }
  }
}

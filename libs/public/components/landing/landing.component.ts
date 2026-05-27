import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { IconComponent } from '@org/shared/ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoDirective],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  private readonly router: Router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  onNeedHelp(): void {
    const win = this.doc.defaultView;
    const token = win?.localStorage.getItem('ihelp_token');
    if (token) {
      this.router.navigate(['/person/request-help']);
    } else {
      this.router.navigate(['/need-help']);
    }
  }
}

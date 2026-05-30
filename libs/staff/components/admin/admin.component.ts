import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AlertBannerComponent, ButtonComponent, IconComponent } from '@org/shared/ui';
import { AdminFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    TranslocoDirective,
    IconComponent,
    ButtonComponent,
    AlertBannerComponent,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit {
  protected readonly facade: AdminFacade = inject(AdminFacade);

  ngOnInit(): void {
    this.facade.loadDashboard();
  }
}

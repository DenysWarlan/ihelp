import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, BadgeComponent } from '@org/shared/ui';
import { AdminFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [TranslocoDirective, DatePipe, CardComponent, BadgeComponent],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogComponent implements OnInit {
  protected readonly facade: AdminFacade = inject(AdminFacade);

  ngOnInit(): void {
    this.facade.loadAuditLog();
  }
}

import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { StaffDashboard } from '@org/staff/data-access';

@Component({
  selector: 'app-consultant',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent, RouterLink],
  templateUrl: './consultant.component.html',
  styleUrl: './consultant.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultantComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);

  readonly dashboard: Signal<StaffDashboard | null> = this.facade.dashboard;

  ngOnInit(): void {
    this.facade.loadDashboard();
  }
}

import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CardComponent, IconComponent } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [TranslocoDirective, CardComponent, IconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);

  readonly dashboard = this.facade.dashboard;
  readonly isLoading = this.facade.isLoading;

  ngOnInit(): void {
    this.facade.loadDashboard();
  }
}

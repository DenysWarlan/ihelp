import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, ButtonComponent, IconComponent } from '@org/shared/ui';
import type { BadgeVariant } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [TranslocoDirective, BadgeComponent, ButtonComponent, IconComponent, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);
  private readonly router: Router = inject(Router);

  readonly dashboard = this.facade.dashboard;
  readonly cases = this.facade.cases;
  readonly isLoading = this.facade.isLoading;

  ngOnInit(): void {
    const role = localStorage.getItem('ihelp_user_role');
    if (role === 'admin') {
      this.router.navigate(['/staff/admin']);
      return;
    }
    if (role === 'coordinator') {
      this.router.navigate(['/staff/coordinator']);
      return;
    }
    if (role === 'supervisor') {
      this.router.navigate(['/staff/supervisor']);
      return;
    }
    this.facade.loadDashboard();
    this.facade.loadCases();
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'OPEN': return 'info';
      case 'IN_PROGRESS': return 'warning';
      case 'WAITING': return 'neutral';
      case 'RESOLVED': return 'success';
      case 'CLOSED': return 'neutral';
      default: return 'neutral';
    }
  }

  getPriorityVariant(priority: string): BadgeVariant {
    switch (priority) {
      case 'CRISIS': return 'error';
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'neutral';
      default: return 'neutral';
    }
  }

  onCaseClick(id: string): void {
    this.facade.navigateToCase(id);
  }
}

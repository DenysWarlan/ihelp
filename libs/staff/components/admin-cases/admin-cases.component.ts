import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, IconComponent } from '@org/shared/ui';
import { AdminFacade } from '@org/staff/data-access';
import type { CaseListItem } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-admin-cases',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    IconComponent,
    FormsModule,
    DatePipe,
  ],
  templateUrl: './admin-cases.component.html',
  styleUrl: './admin-cases.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCasesComponent implements OnInit {
  private readonly facade: AdminFacade = inject(AdminFacade);
  private readonly router: Router = inject(Router);

  readonly allCases: Signal<CaseListItem[]> = this.facade.cases;
  readonly isLoading: Signal<boolean> = this.facade.casesLoading;
  readonly searchQuery: WritableSignal<string> = signal('');
  readonly statusFilter: WritableSignal<string> = signal('');

  readonly filteredCases: Signal<CaseListItem[]> = computed(() => {
    const query: string = this.searchQuery().toLowerCase().trim();
    const filter: string = this.statusFilter();
    let cases: CaseListItem[] = this.allCases();
    if (filter === 'WAITING') {
      cases = cases.filter((c: CaseListItem) => c.status === 'NEW' || c.status === 'ASSIGNED');
    } else if (filter === 'ACTIVE') {
      cases = cases.filter((c: CaseListItem) => c.status === 'IN_PROGRESS' || c.status === 'MEETING_SCHEDULED');
    } else if (filter === 'DONE') {
      cases = cases.filter((c: CaseListItem) => c.status === 'COMPLETED' || c.status === 'CLOSED');
    }
    if (query) {
      cases = cases.filter(
        (c: CaseListItem) =>
          c.personName.toLowerCase().includes(query) ||
          (c.consultantName ?? '').toLowerCase().includes(query) ||
          c.topic.toLowerCase().includes(query),
      );
    }
    return cases;
  });

  readonly totalCases: Signal<number> = computed(() => this.allCases().length);

  readonly waitingCases: Signal<number> = computed(
    () => this.allCases().filter((c: CaseListItem) => c.status === 'NEW' || c.status === 'ASSIGNED').length,
  );

  readonly inProgressCases: Signal<number> = computed(
    () => this.allCases().filter((c: CaseListItem) => c.status === 'IN_PROGRESS' || c.status === 'MEETING_SCHEDULED').length,
  );

  readonly resolvedCases: Signal<number> = computed(
    () => this.allCases().filter((c: CaseListItem) => c.status === 'COMPLETED' || c.status === 'CLOSED').length,
  );

  ngOnInit(): void {
    this.facade.loadCases();
  }

  onCaseClick(id: string): void {
    this.router.navigate(['/staff/cases', id]);
  }

  onFilterStatus(status: string): void {
    this.statusFilter.set(this.statusFilter() === status ? '' : status);
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'NEW':
      case 'ASSIGNED':
        return 'info';
      case 'IN_PROGRESS':
      case 'MEETING_SCHEDULED':
        return 'warning';
      case 'ON_HOLD':
      case 'TRANSFERRED':
        return 'neutral';
      case 'COMPLETED':
        return 'success';
      case 'CLOSED':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  getPriorityVariant(priority: string): BadgeVariant {
    switch (priority) {
      case 'CRISIS':
        return 'error';
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'neutral';
      default:
        return 'neutral';
    }
  }
}

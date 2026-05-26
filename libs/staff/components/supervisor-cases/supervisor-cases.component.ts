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
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, IconComponent } from '@org/shared/ui';
import { SupervisorFacadeService } from '@org/staff/data-access';
import type { CaseListItem } from '@org/staff/data-access';
import type { BadgeVariant } from '@org/shared/ui';

@Component({
  selector: 'app-supervisor-cases',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    IconComponent,
    FormsModule,
    DatePipe,
  ],
  templateUrl: './supervisor-cases.component.html',
  styleUrl: './supervisor-cases.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorCasesComponent implements OnInit {
  private readonly facade: SupervisorFacadeService =
    inject(SupervisorFacadeService);

  readonly allCases: Signal<CaseListItem[]> = this.facade.allCases;
  readonly isLoading: Signal<boolean> = this.facade.isLoading;
  readonly searchQuery: WritableSignal<string> = signal('');

  readonly filteredCases: Signal<CaseListItem[]> = computed(() => {
    const query: string = this.searchQuery().toLowerCase().trim();
    const cases: CaseListItem[] = this.allCases();
    if (!query) {
      return cases;
    }
    return cases.filter(
      (c: CaseListItem) =>
        c.personName.toLowerCase().includes(query) ||
        (c.consultantName ?? '').toLowerCase().includes(query)
    );
  });

  readonly totalCases: Signal<number> = computed(
    () => this.allCases().length
  );

  readonly crisisCases: Signal<number> = computed(
    () => this.allCases().filter((c: CaseListItem) => c.priority === 'CRISIS').length
  );

  readonly waitingCases: Signal<number> = computed(
    () => this.allCases().filter((c: CaseListItem) => c.status === 'WAITING').length
  );

  readonly resolvedCases: Signal<number> = computed(
    () => this.allCases().filter((c: CaseListItem) => c.status === 'RESOLVED').length
  );

  ngOnInit(): void {
    this.facade.loadAllCases();
  }

  onCaseClick(id: string): void {
    this.facade.navigateToCase(id);
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'OPEN':
        return 'success';
      case 'IN_PROGRESS':
        return 'info';
      case 'WAITING':
        return 'neutral';
      case 'RESOLVED':
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

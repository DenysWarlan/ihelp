import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  IconComponent,
} from '@org/shared/ui';
import { DuplicateFacade, DuplicateGroup } from '@org/staff/data-access';

@Component({
  selector: 'app-duplicate-list',
  standalone: true,
  imports: [
    TranslocoDirective,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './duplicate-list.component.html',
  styleUrl: './duplicate-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicateListComponent implements OnInit {
  protected readonly facade: DuplicateFacade = inject(DuplicateFacade);
  private readonly router: Router = inject(Router);

  protected readonly groups: Signal<DuplicateGroup[]> = this.facade.groups;
  protected readonly total: Signal<number> = this.facade.total;
  protected readonly confidenceFilters: readonly string[] = [
    'ALL',
    'HIGH',
    'MEDIUM',
    'LOW',
  ] as const;

  ngOnInit(): void {
    this.facade.loadGroups();
  }

  protected onConfidenceFilter(confidence: string): void {
    this.facade.setConfidenceFilter(
      confidence === 'ALL' ? undefined : confidence,
    );
  }

  protected onReviewGroup(group: DuplicateGroup): void {
    this.router.navigate(['/staff/duplicates', group.groupId]);
  }

  protected onDismissGroup(group: DuplicateGroup): void {
    this.facade.dismissGroup(group.groupId);
  }

  protected onBackToUsers(): void {
    this.router.navigate(['/staff/users']);
  }

  protected getConfidenceFilterLabel(filter: string): string {
    return filter;
  }

  protected isActiveFilter(filter: string): boolean {
    const current: string | undefined = this.facade.confidenceFilter();
    return filter === 'ALL' ? !current : current === filter;
  }
}

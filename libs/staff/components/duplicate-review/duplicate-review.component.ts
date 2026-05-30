import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  IconComponent,
  ModalComponent,
} from '@org/shared/ui';
import {
  DuplicateFacade,
  DuplicateGroup,
  DuplicateUserSummary,
  MergeExecutionResult,
} from '@org/staff/data-access';

@Component({
  selector: 'app-duplicate-review',
  standalone: true,
  imports: [
    DatePipe,
    TranslocoDirective,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './duplicate-review.component.html',
  styleUrl: './duplicate-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicateReviewComponent implements OnInit {
  protected readonly facade: DuplicateFacade = inject(DuplicateFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  protected readonly group: Signal<DuplicateGroup | null> =
    this.facade.selectedGroup;
  protected readonly mergeResult: Signal<MergeExecutionResult | null> =
    this.facade.mergeResult;

  private groupId = '';

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    if (this.groupId) {
      this.facade.loadGroupDetail(this.groupId);
    }
  }

  protected onBackToList(): void {
    this.facade.clearSelectedGroup();
    this.router.navigate(['/staff/duplicates']);
  }

  protected onOpenMerge(): void {
    const g: DuplicateGroup | null = this.group();
    if (g) {
      this.facade.openMergeConfirm(g);
    }
  }

  protected onCloseMerge(): void {
    this.facade.closeMergeConfirm();
  }

  protected onSwap(): void {
    this.facade.swapPrimarySecondary();
  }

  protected onConfirmMerge(): void {
    this.facade.executeMerge(this.groupId);
  }

  protected onDismiss(): void {
    this.facade.dismissGroup(this.groupId);
    this.router.navigate(['/staff/duplicates']);
  }

  protected getPrimaryUser(): DuplicateUserSummary | undefined {
    const g: DuplicateGroup | null = this.group();
    const primaryId: string | null = this.facade.selectedPrimaryId();
    if (!g) return undefined;
    const id: string = primaryId ?? g.suggestedPrimaryId;
    return g.users.find((u: DuplicateUserSummary) => u.id === id);
  }

  protected getSecondaryUser(): DuplicateUserSummary | undefined {
    const g: DuplicateGroup | null = this.group();
    const secondaryId: string | null = this.facade.selectedSecondaryId();
    if (!g) return undefined;
    if (secondaryId) {
      return g.users.find((u: DuplicateUserSummary) => u.id === secondaryId);
    }
    const primaryId: string = this.facade.selectedPrimaryId() ?? g.suggestedPrimaryId;
    return g.users.find((u: DuplicateUserSummary) => u.id !== primaryId);
  }
}

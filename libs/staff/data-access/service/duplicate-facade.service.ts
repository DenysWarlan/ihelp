import { inject, Injectable, Signal, WritableSignal, signal } from '@angular/core';

import { DuplicateStore } from '../store/duplicate.store';
import {
  DuplicateGroup,
  DuplicateUserSummary,
  ExecuteMergeRequest,
  MergeExecutionResult,
} from '../model/duplicate.model';

@Injectable({ providedIn: 'root' })
export class DuplicateFacade {
  private readonly store = inject(DuplicateStore);

  readonly groups: Signal<DuplicateGroup[]> = this.store.groups;
  readonly total: Signal<number> = this.store.total;
  readonly selectedGroup: Signal<DuplicateGroup | null> =
    this.store.selectedGroup;
  readonly mergeResult: Signal<MergeExecutionResult | null> =
    this.store.mergeResult;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly isMerging: Signal<boolean> = this.store.isMerging;
  readonly error: Signal<string | null> = this.store.error;

  readonly showMergeConfirmModal: WritableSignal<boolean> = signal(false);
  readonly selectedPrimaryId: WritableSignal<string | null> = signal(null);
  readonly selectedSecondaryId: WritableSignal<string | null> = signal(null);
  readonly confidenceFilter: WritableSignal<string | undefined> =
    signal(undefined);

  loadGroups(confidence?: string): void {
    this.store.loadGroups(confidence);
  }

  loadGroupDetail(groupId: string): void {
    this.store.loadGroupDetail(groupId);
  }

  dismissGroup(groupId: string, reason?: string): void {
    this.store.dismissGroup({ groupId, reason });
  }

  openMergeConfirm(group: DuplicateGroup): void {
    this.selectedPrimaryId.set(group.suggestedPrimaryId);
    const secondary: DuplicateUserSummary | undefined = group.users.find(
      (u: DuplicateUserSummary) => u.id !== group.suggestedPrimaryId,
    );
    this.selectedSecondaryId.set(secondary?.id ?? null);
    this.showMergeConfirmModal.set(true);
  }

  closeMergeConfirm(): void {
    this.showMergeConfirmModal.set(false);
    this.selectedPrimaryId.set(null);
    this.selectedSecondaryId.set(null);
  }

  swapPrimarySecondary(): void {
    const primary: string | null = this.selectedPrimaryId();
    const secondary: string | null = this.selectedSecondaryId();
    this.selectedPrimaryId.set(secondary);
    this.selectedSecondaryId.set(primary);
  }

  executeMerge(groupId: string): void {
    const primaryUserId: string | null = this.selectedPrimaryId();
    const secondaryUserId: string | null = this.selectedSecondaryId();
    if (!primaryUserId || !secondaryUserId) return;

    const dto: ExecuteMergeRequest = { primaryUserId, secondaryUserId };
    this.store.executeMerge({ groupId, dto });
    this.closeMergeConfirm();
  }

  setConfidenceFilter(confidence: string | undefined): void {
    this.confidenceFilter.set(confidence);
    this.loadGroups(confidence);
  }

  clearSelectedGroup(): void {
    this.store.clearSelectedGroup();
  }

  clearMergeResult(): void {
    this.store.clearMergeResult();
  }

  clearError(): void {
    this.store.clearError();
  }

  getConfidenceBadgeVariant(
    confidence: string,
  ): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    switch (confidence) {
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'neutral';
    }
  }

  getMatchReasonLabel(reason: string): string {
    switch (reason) {
      case 'EXACT_EMAIL':
        return 'Exact email match';
      case 'EXACT_NAME':
        return 'Exact name match';
      case 'SAME_TELEGRAM':
        return 'Same Telegram account';
      case 'TELEGRAM_CONTACT':
        return 'Telegram contact match';
      case 'SHARED_REAL_EMAIL':
        return 'Shared real email';
      default:
        return reason;
    }
  }
}

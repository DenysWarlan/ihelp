import { inject, Injectable, Signal } from '@angular/core';

import { GdprStore } from '../store/gdpr.store';
import {
  GdprAccessRequest,
  GdprRetentionPolicy,
  GdprSarKeyword,
  GdprAuditEntry,
  GdprTab,
} from '../model/gdpr.model';

@Injectable({ providedIn: 'root' })
export class GdprFacade {
  private readonly store = inject(GdprStore);

  readonly accessRequests: Signal<GdprAccessRequest[]> =
    this.store.accessRequests;
  readonly retentionPolicies: Signal<GdprRetentionPolicy[]> =
    this.store.retentionPolicies;
  readonly sarKeywords: Signal<GdprSarKeyword[]> = this.store.sarKeywords;
  readonly auditLog: Signal<GdprAuditEntry[]> = this.store.auditLog;
  readonly activeTab: Signal<GdprTab> = this.store.activeTab;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  setActiveTab(tab: GdprTab): void {
    this.store.setActiveTab(tab);
    switch (tab) {
      case 'accessRequests':
        this.loadAccessRequests();
        break;
      case 'retentionPolicies':
        this.loadRetentionPolicies();
        break;
      case 'sarKeywords':
        this.loadSarKeywords();
        break;
    }
  }

  loadAccessRequests(status?: string): void {
    this.store.loadAccessRequests(status);
  }

  loadRetentionPolicies(): void {
    this.store.loadRetentionPolicies();
  }

  loadSarKeywords(): void {
    this.store.loadSarKeywords();
  }

  loadAuditLog(): void {
    this.store.loadAuditLog();
  }

  approveRequest(id: string): void {
    this.store.approveRequest(id);
  }

  rejectRequest(id: string, reason?: string): void {
    this.store.rejectRequest({ id, reason });
  }

  getStatusBadgeVariant(
    status: string
  ): 'success' | 'warning' | 'error' | 'neutral' {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'EXPIRED':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  getActiveBadgeVariant(isActive: boolean): 'success' | 'neutral' {
    return isActive ? 'success' : 'neutral';
  }
}

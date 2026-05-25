import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import { BadgeComponent, BadgeVariant, ButtonComponent, IconComponent, InputComponent } from '@org/shared/ui';
import { AdminFacade, AuditLogEntry } from '@org/staff/data-access';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [TranslocoDirective, DatePipe, FormsModule, BadgeComponent, ButtonComponent, IconComponent, InputComponent],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogComponent implements OnInit {
  protected readonly facade: AdminFacade = inject(AdminFacade);

  readonly searchQuery = signal<string>('');

  readonly filteredLog = computed<AuditLogEntry[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const entries = this.facade.auditLog();

    if (!query) {
      return entries;
    }

    return entries.filter(
      (entry) =>
        entry.actorName.toLowerCase().includes(query) ||
        entry.action.toLowerCase().includes(query) ||
        entry.entityType.toLowerCase().includes(query) ||
        (entry.details?.toLowerCase().includes(query) ?? false),
    );
  });

  ngOnInit(): void {
    this.facade.loadAuditLog();
  }

  getActionBadgeVariant(action: string): BadgeVariant {
    const normalized = action.toUpperCase();

    if (normalized.includes('CREATE') || normalized.includes('INSERT')) {
      return 'success';
    }
    if (normalized.includes('UPDATE')) {
      return 'info';
    }
    if (normalized.includes('DELETE') || normalized.includes('DEACTIVAT')) {
      return 'error';
    }
    if (normalized.includes('SLA') || normalized.includes('BREACH')) {
      return 'warning';
    }

    return 'neutral';
  }

  onDateFilter(): void {
    // Date picker integration — placeholder
  }

  onExportAll(): void {
    // Export functionality — placeholder
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import type { SortEvent, TableColumn } from './table.model';

@Component({
  selector: 'ui-table',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableComponent {
  readonly columns = input.required<TableColumn[]>();
  readonly data = input.required<unknown[]>();
  readonly sortable = input<boolean>(false);

  readonly sort = output<SortEvent>();

  protected readonly sortKey = signal<string>('');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  protected onSort(column: TableColumn): void {
    if (!this.sortable() || column.sortable === false) {
      return;
    }

    const key = column.key;
    const currentKey = this.sortKey();
    const currentDir = this.sortDirection();

    const direction: 'asc' | 'desc' =
      currentKey === key && currentDir === 'asc' ? 'desc' : 'asc';

    this.sortKey.set(key);
    this.sortDirection.set(direction);
    this.sort.emit({ key, direction });
  }

  protected getCellValue(row: unknown, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }
}

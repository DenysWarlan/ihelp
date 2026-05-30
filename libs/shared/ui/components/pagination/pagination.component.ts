import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  Signal,
} from '@angular/core';
import { LucideAngularModule, icons } from 'lucide-angular';

import { PageChangeEvent } from './pagination.model';

@Component({
  selector: 'ui-pagination',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input<number>(20);

  readonly pageChange = output<PageChangeEvent>();

  protected readonly chevronLeft = icons['ChevronLeft'];
  protected readonly chevronRight = icons['ChevronRight'];

  protected readonly pages: Signal<number[]> = computed(() => {
    const current: number = this.currentPage();
    const total: number = this.totalPages();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [1];

    if (current > 3) {
      pages.push(-1); // ellipsis
    }

    const start: number = Math.max(2, current - 1);
    const end: number = Math.min(total - 1, current + 1);

    for (let i: number = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push(-1); // ellipsis
    }

    pages.push(total);

    return pages;
  });

  protected readonly rangeStart: Signal<number> = computed(() =>
    (this.currentPage() - 1) * this.pageSize() + 1,
  );

  protected readonly rangeEnd: Signal<number> = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.total()),
  );

  protected onPageClick(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.pageChange.emit({ page, pageSize: this.pageSize() });
  }

  protected onPrev(): void {
    this.onPageClick(this.currentPage() - 1);
  }

  protected onNext(): void {
    this.onPageClick(this.currentPage() + 1);
  }
}

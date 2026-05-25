import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { IconComponent } from '../icon/icon.component';
import type { ModalSize } from './modal.model';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalComponent implements AfterViewChecked {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly size = input<ModalSize>('md');

  readonly closed = output<void>();

  protected readonly dialogRef = viewChild<ElementRef>('dialog');

  private readonly doc = inject(DOCUMENT);
  private readonly needsFocus = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.needsFocus.set(true);
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.needsFocus()) {
      this.needsFocus.set(false);
      this.focusFirstElement();
    }
  }

  protected get titleId(): string {
    return 'modal-title';
  }

  protected onOverlayClick(event: unknown): void {
    const e = event as { target: { classList: { contains: (cls: string) => boolean } } };
    if (e.target.classList.contains('modal__overlay')) {
      this.close();
    }
  }

  protected onKeydown(event: unknown): void {
    if (!this.isOpen()) {
      return;
    }

    const kbEvent = event as { key: string; shiftKey: boolean; preventDefault: () => void };

    if (kbEvent.key === 'Escape') {
      kbEvent.preventDefault();
      this.close();
      return;
    }

    if (kbEvent.key === 'Tab') {
      this.trapFocus(kbEvent);
    }
  }

  private close(): void {
    this.closed.emit();
  }

  private trapFocus(event: { key: string; shiftKey: boolean; preventDefault: () => void }): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) {
      return;
    }

    const focusableElements = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = this.doc.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private focusFirstElement(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) {
      return;
    }

    const focusable = dialog.querySelector(FOCUSABLE_SELECTOR);
    focusable?.focus();
  }
}

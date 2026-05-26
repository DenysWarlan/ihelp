import { Injectable, signal } from '@angular/core';
import { Toast, ToastVariant } from './toast.model';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  show(
    message: string,
    options?: { title?: string; variant?: ToastVariant; duration?: number },
  ): void {
    const toast: Toast = {
      id: this.nextId++,
      message,
      title: options?.title,
      variant: options?.variant ?? 'info',
      duration: options?.duration ?? 4000,
    };
    this.toasts.update((list) => [...list, toast]);

    const ST = (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout;
    ST(() => this.dismiss(toast.id), toast.duration);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

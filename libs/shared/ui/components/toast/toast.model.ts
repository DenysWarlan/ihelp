export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly title?: string;
  readonly variant: ToastVariant;
  readonly duration: number;
}

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

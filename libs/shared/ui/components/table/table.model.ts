export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly sortable?: boolean;
  readonly width?: string;
}

export interface SortEvent {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

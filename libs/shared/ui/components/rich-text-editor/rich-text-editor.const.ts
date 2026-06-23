export interface RichTextBlock {
  readonly tag: string;
  readonly label: string;
}

export const RICH_TEXT_BLOCK_OPTIONS: readonly RichTextBlock[] = [
  { tag: 'p', label: 'Текст' },
  { tag: 'h2', label: 'Заголовок' },
  { tag: 'h3', label: 'Підзаголовок' },
] as const;

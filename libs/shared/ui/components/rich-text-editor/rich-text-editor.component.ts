import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon/icon.component';
import { RICH_TEXT_BLOCK_OPTIONS, RichTextBlock } from './rich-text-editor.const';

@Component({
  selector: 'ui-rich-text-editor',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  private static nextId = 0;
  readonly editorId: string = `ui-rte-${RichTextEditorComponent.nextId++}`;
  readonly label = input('');
  readonly placeholder = input('');
  readonly errorMessage = input<string | null>(null);

  readonly blockOptions: readonly RichTextBlock[] = RICH_TEXT_BLOCK_OPTIONS;

  readonly isDisabled = signal(false);
  readonly isEmpty = signal(true);

  private readonly editor = viewChild<ElementRef<HTMLDivElement>>('editor');
  private readonly model = signal('');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Sync model -> DOM once the editor element is available, without
    // overwriting content the user is actively typing.
    effect(() => {
      const el: HTMLDivElement | undefined = this.editor()?.nativeElement;
      const html: string = this.model();
      if (el && el.innerHTML !== html) {
        el.innerHTML = html;
      }
    });
  }

  writeValue(value: string): void {
    const html: string = value ?? '';
    this.model.set(html);
    this.isEmpty.set(this.stripHtml(html).length === 0);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onInput(): void {
    this.emit();
  }

  onBlur(): void {
    this.onTouched();
  }

  protected exec(command: string, value?: string): void {
    const el: HTMLDivElement | undefined = this.editor()?.nativeElement;
    if (this.isDisabled() || !el) return;
    el.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command, false, value);
    this.emit();
  }

  protected onBlockChange(value: string): void {
    // formatBlock requires the tag wrapped in <> on some browsers
    this.exec('formatBlock', `<${value}>`);
  }

  protected onCreateLink(): void {
    if (this.isDisabled()) return;
    const url: string | null = window.prompt('URL');
    if (url) {
      this.exec('createLink', url);
    }
  }

  protected onInsertImage(): void {
    if (this.isDisabled()) return;
    const url: string | null = window.prompt('URL');
    if (url) {
      this.exec('insertImage', url);
    }
  }

  private emit(): void {
    const el: HTMLDivElement | undefined = this.editor()?.nativeElement;
    if (!el) return;
    const html: string = el.innerHTML;
    // Keep model in sync so the effect does not re-write the DOM (avoids
    // resetting the caret position while typing).
    this.model.set(html);
    this.isEmpty.set(this.stripHtml(html).length === 0);
    this.onChange(html);
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}

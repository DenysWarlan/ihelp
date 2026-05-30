import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'ui-input',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  private static nextId = 0;
  readonly inputId: string = `ui-input-${InputComponent.nextId++}`;
  readonly label = input('');
  readonly placeholder = input('');
  readonly type = input('text');
  readonly errorMessage = input<string | null>(null);

  readonly value = signal('');
  readonly isDisabled = signal(false);
  readonly passwordVisible = signal(false);
  readonly resolvedType = computed(() =>
    this.type() === 'password' && this.passwordVisible() ? 'text' : this.type()
  );

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value ?? '');
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

  onInput(event: { target: { value: string } }): void {
    const val = event.target.value;
    this.value.set(val);
    this.onChange(val);
  }

  onBlur(): void {
    this.onTouched();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }
}

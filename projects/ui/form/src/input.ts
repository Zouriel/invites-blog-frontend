import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

/**
 * `ui-input` — single-line text field. Implements ControlValueAccessor so it
 * works with template-driven, reactive, and Signal Forms.
 */
@Component({
  selector: 'ui-input',
  template: `
    <input
      class="ui-input"
      [class.no-radius]="!radius()"
      [attr.data-size]="size()"
      [attr.type]="type()"
      [attr.placeholder]="placeholder()"
      [attr.inputmode]="inputmode()"
      [attr.aria-invalid]="invalid() || null"
      [value]="value()"
      [disabled]="disabled()"
      (input)="handleInput($event)"
      (blur)="onTouched()" />
  `,
  styles: `
    :host { display: block; }
    .ui-input {
      width: 100%; box-sizing: border-box;
      height: var(--ui-size-md); padding: 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-input::placeholder { color: var(--ui-color-text-muted); }
    .ui-input:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .ui-input:disabled { opacity: 0.55; cursor: not-allowed; }
    .ui-input.no-radius { border-radius: 0; }
    .ui-input[data-size="sm"] { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .ui-input[data-size="lg"] { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .ui-input[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .ui-input[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-danger) 30%, transparent); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiInput), multi: true }],
})
export class UiInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  type = input<'text' | 'email' | 'url' | 'tel' | 'password' | 'search'>('text');
  placeholder = input('');
  inputmode = input<string>();
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}

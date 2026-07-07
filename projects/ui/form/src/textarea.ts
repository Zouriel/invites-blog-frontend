import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from 'ui';

/** `ui-textarea` — multi-line text field (CVA). */
@Component({
  selector: 'ui-textarea',
  template: `
    <textarea
      class="ui-textarea"
      [class.no-radius]="!radius()"
      [attr.placeholder]="placeholder()"
      [attr.rows]="rows()"
      [attr.aria-invalid]="invalid() || null"
      [value]="value()"
      [disabled]="disabled()"
      (input)="handleInput($event)"
      (blur)="onTouched()"></textarea>
  `,
  styles: `
    :host { display: block; }
    .ui-textarea {
      width: 100%; box-sizing: border-box; resize: vertical;
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.5;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-textarea::placeholder { color: var(--ui-color-text-muted); }
    .ui-textarea:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .ui-textarea:disabled { opacity: 0.55; cursor: not-allowed; }
    .ui-textarea.no-radius { border-radius: 0; }
    .ui-textarea[aria-invalid="true"] { border-color: var(--ui-color-danger); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTextarea), multi: true }],
})
export class UiTextarea implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  placeholder = input('');
  rows = input(4);
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
    const v = (e.target as HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}

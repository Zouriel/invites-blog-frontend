import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

/** `ui-password-input` — password field with show/hide toggle (CVA). */
@Component({
  selector: 'ui-password-input',
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <input
        class="ui-pw"
        [attr.type]="reveal() ? 'text' : 'password'"
        [attr.placeholder]="placeholder()"
        [attr.aria-invalid]="invalid() || null"
        autocomplete="current-password"
        [value]="value()"
        [disabled]="disabled()"
        (input)="handleInput($event)"
        (blur)="onTouched()" />
      <button type="button" class="toggle" tabindex="-1"
              [attr.aria-label]="reveal() ? 'Hide password' : 'Show password'"
              [disabled]="disabled()" (click)="reveal.set(!reveal())">
        {{ reveal() ? '🙈' : '👁' }}
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; align-items: stretch; border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); background: var(--ui-color-surface);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .wrap:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .wrap.no-radius { border-radius: 0; }
    .ui-pw { flex: 1; min-width: 0; height: var(--ui-size-md); padding: 0 var(--ui-space-3); border: none; background: transparent;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none; }
    .wrap[data-size="sm"] .ui-pw { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-pw { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .toggle { border: none; background: transparent; cursor: pointer; padding: 0 var(--ui-space-2); font-size: 14px; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiPasswordInput), multi: true }],
})
export class UiPasswordInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  placeholder = input('');
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly reveal = signal(false);
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

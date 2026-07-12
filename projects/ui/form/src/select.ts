import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

export interface UiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/**
 * `ui-select` — single-choice dropdown (CVA) built on a native `<select>` for
 * full keyboard/screen-reader support. For rich filtering use combobox instead.
 */
@Component({
  selector: 'ui-select',
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <select
        class="ui-select"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-label]="label()"
        (change)="handleChange($event)"
        (blur)="onTouched()">
        <!--
          Selectedness is bound per-option (a pure function of value()) rather than via [value] on
          the <select>. With [value] alone, async-loaded options make the browser silently reset the
          selection to the first enabled option WITHOUT firing 'change', so the displayed option and
          the control value drift apart (placeholder shows an option that was never actually chosen).
        -->
        @if (placeholder()) {
          <option value="" disabled [selected]="!value()">{{ placeholder() }}</option>
        }
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === value()" [disabled]="!!opt.disabled">{{ opt.label }}</option>
        }
      </select>
      <span class="chevron" aria-hidden="true">▾</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    .ui-select {
      width: 100%; box-sizing: border-box; appearance: none;
      height: var(--ui-size-md); padding: 0 var(--ui-space-6) 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); cursor: pointer;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-select:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .ui-select:disabled { opacity: 0.55; cursor: not-allowed; }
    .wrap.no-radius .ui-select { border-radius: 0; }
    .wrap[data-size="sm"] .ui-select { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-select { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .ui-select[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .chevron { position: absolute; right: var(--ui-space-3); top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--ui-color-text-muted); }
    option { color: initial; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelect), multi: true }],
})
export class UiSelect implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  options = input<UiSelectOption[]>([]);
  placeholder = input<string>();
  label = input<string>();
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

  protected handleChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.value.set(v);
    this.onChange(v);
  }
}

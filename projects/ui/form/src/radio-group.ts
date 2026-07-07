import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface UiRadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

let radioGroupSeq = 0;

/**
 * `ui-radio-group` — single-choice control (CVA). Built on native radio inputs
 * so keyboard interaction and group semantics are handled by the platform.
 */
@Component({
  selector: 'ui-radio-group',
  template: `
    <div class="ui-radio-group" role="radiogroup" [attr.aria-label]="label()" [class.row]="orientation() === 'horizontal'">
      @for (opt of options(); track opt.value) {
        <label class="opt" [class.disabled]="disabled() || opt.disabled">
          <input
            type="radio"
            class="native"
            [name]="name"
            [value]="opt.value"
            [checked]="opt.value === value()"
            [disabled]="disabled() || !!opt.disabled"
            (change)="select(opt.value)"
            (blur)="onTouched()" />
          <span class="dot" aria-hidden="true"></span>
          <span class="text">{{ opt.label }}</span>
        </label>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-radio-group { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .ui-radio-group.row { flex-direction: row; flex-wrap: wrap; gap: var(--ui-space-4); }
    .opt { display: inline-flex; align-items: center; gap: var(--ui-space-2); cursor: pointer; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .opt.disabled { opacity: 0.55; cursor: not-allowed; }
    .native { position: absolute; opacity: 0; width: 0; height: 0; }
    .dot {
      width: 18px; height: 18px; flex: none; border-radius: 50%;
      border: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      display: inline-flex; align-items: center; justify-content: center;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--ui-color-primary); transform: scale(0); transition: transform var(--ui-motion-fast) var(--ui-ease-spring); }
    .native:checked + .dot { border-color: var(--ui-color-primary); }
    .native:checked + .dot::after { transform: scale(1); }
    .native:focus-visible + .dot { box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiRadioGroup), multi: true }],
})
export class UiRadioGroup implements ControlValueAccessor {
  options = input<UiRadioOption[]>([]);
  label = input<string>();
  orientation = input<'vertical' | 'horizontal'>('vertical');
  protected readonly name = `ui-radio-${radioGroupSeq++}`;

  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected select(v: string): void {
    this.value.set(v);
    this.onChange(v);
  }
}

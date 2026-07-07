import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface UiCheckboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** `ui-checkbox-group` — multi-select checkbox set (CVA; value is string[]). */
@Component({
  selector: 'ui-checkbox-group',
  template: `
    <div class="grp" role="group" [attr.aria-label]="label()" [class.row]="orientation() === 'horizontal'">
      @for (opt of options(); track opt.value) {
        <label class="opt" [class.disabled]="disabled() || opt.disabled">
          <input type="checkbox" class="native"
                 [checked]="selected().has(opt.value)"
                 [disabled]="disabled() || !!opt.disabled"
                 (change)="toggle(opt.value)" (blur)="onTouched()" />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 16 16" class="tick"><path d="M3 8.5l3 3 7-7" /></svg>
          </span>
          <span class="text">{{ opt.label }}</span>
        </label>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .grp { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .grp.row { flex-direction: row; flex-wrap: wrap; gap: var(--ui-space-4); }
    .opt { display: inline-flex; align-items: center; gap: var(--ui-space-2); cursor: pointer; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .opt.disabled { opacity: 0.55; cursor: not-allowed; }
    .native { position: absolute; opacity: 0; width: 0; height: 0; }
    .box { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex: none;
      border: 1px solid var(--ui-color-border); border-radius: 5px; background: var(--ui-color-surface);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard); }
    .tick { width: 12px; height: 12px; fill: none; stroke: var(--ui-color-primary-contrast); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 16; stroke-dashoffset: 16; transition: stroke-dashoffset var(--ui-motion-base) var(--ui-ease-standard); }
    .native:checked + .box { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .native:checked + .box .tick { stroke-dashoffset: 0; }
    .native:focus-visible + .box { box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCheckboxGroup), multi: true }],
})
export class UiCheckboxGroup implements ControlValueAccessor {
  options = input<UiCheckboxOption[]>([]);
  label = input<string>();
  orientation = input<'vertical' | 'horizontal'>('vertical');

  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly disabled = signal(false);
  private onChange: (v: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string[]): void { this.selected.set(new Set(v ?? [])); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected toggle(value: string): void {
    const next = new Set(this.selected());
    next.has(value) ? next.delete(value) : next.add(value);
    this.selected.set(next);
    this.onChange([...next]);
  }
}

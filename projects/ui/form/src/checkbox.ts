import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-checkbox` — boolean control (CVA) built on a native checkbox for a11y. */
@Component({
  selector: 'ui-checkbox',
  template: `
    <label class="ui-checkbox" [class.disabled]="disabled()">
      <input
        type="checkbox"
        class="native"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() || null"
        (change)="toggle($event)"
        (blur)="onTouched()" />
      <span class="box" aria-hidden="true">
        <svg viewBox="0 0 16 16" class="tick"><path d="M3 8.5l3 3 7-7" /></svg>
      </span>
      <span class="text"><ng-content /></span>
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-checkbox { display: inline-flex; align-items: center; gap: var(--ui-space-2); cursor: pointer; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .ui-checkbox.disabled { opacity: 0.55; cursor: not-allowed; }
    .native { position: absolute; opacity: 0; width: 0; height: 0; }
    .box {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; flex: none;
      border: 1px solid var(--ui-color-border); border-radius: 5px;
      background: var(--ui-color-surface);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .tick { width: 12px; height: 12px; fill: none; stroke: var(--ui-color-primary-contrast); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 16; stroke-dashoffset: 16; transition: stroke-dashoffset var(--ui-motion-base) var(--ui-ease-standard); }
    .native:checked + .box { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .native:checked + .box .tick { stroke-dashoffset: 0; }
    .native:focus-visible + .box { box-shadow: var(--ui-focus-ring); }
    .native[aria-invalid="true"] + .box { border-color: var(--ui-color-danger); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCheckbox), multi: true }],
})
export class UiCheckbox implements ControlValueAccessor {
  invalid = input(false);

  protected readonly checked = signal(false);
  protected readonly disabled = signal(false);
  private onChange: (v: boolean) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: boolean): void { this.checked.set(!!v); }
  registerOnChange(fn: (v: boolean) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected toggle(e: Event): void {
    const v = (e.target as HTMLInputElement).checked;
    this.checked.set(v);
    this.onChange(v);
  }
}

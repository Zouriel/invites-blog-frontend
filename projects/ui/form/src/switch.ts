import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-switch` — on/off toggle (CVA). Uses role="switch" on a native checkbox. */
@Component({
  selector: 'ui-switch',
  template: `
    <label class="ui-switch" [class.disabled]="disabled()">
      <input
        type="checkbox"
        role="switch"
        class="native"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-checked]="checked()"
        (change)="toggle($event)"
        (blur)="onTouched()" />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span class="text"><ng-content /></span>
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-switch { display: inline-flex; align-items: center; gap: var(--ui-space-2); cursor: pointer; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .ui-switch.disabled { opacity: 0.55; cursor: not-allowed; }
    .native { position: absolute; opacity: 0; width: 0; height: 0; }
    .track {
      position: relative; width: 38px; height: 22px; flex: none;
      background: var(--ui-color-border); border-radius: 999px;
      transition: background var(--ui-motion-base) var(--ui-ease-standard);
    }
    .thumb {
      position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
      background: #fff; border-radius: 50%; box-shadow: var(--ui-shadow-1);
      transition: transform var(--ui-motion-base) var(--ui-ease-spring);
    }
    .native:checked + .track { background: var(--ui-color-primary); }
    .native:checked + .track .thumb { transform: translateX(16px); }
    .native:focus-visible + .track { box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSwitch), multi: true }],
})
export class UiSwitch implements ControlValueAccessor {
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

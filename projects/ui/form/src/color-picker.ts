import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from 'ui';

/** `ui-color-picker` — native color well + hex field + preset swatches (CVA; value is hex). */
@Component({
  selector: 'ui-color-picker',
  template: `
    <div class="cp" [class.no-radius]="!radius()">
      <label class="well" [style.background]="value()">
        <input type="color" [value]="value()" [disabled]="disabled()" (input)="set($any($event.target).value)" aria-label="Pick color" />
      </label>
      <input class="hex" [value]="value()" [disabled]="disabled()" (input)="set($any($event.target).value)" (blur)="onTouched()" aria-label="Hex color" />
      <div class="swatches">
        @for (c of swatches(); track c) {
          <button type="button" class="sw" [style.background]="c" [attr.aria-label]="c" (click)="set(c)"></button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .cp { display: flex; align-items: center; gap: var(--ui-space-2); }
    .well { width: var(--ui-size-md); height: var(--ui-size-md); border-radius: var(--ui-radius); border: 1px solid var(--ui-color-border); overflow: hidden; cursor: pointer; flex: none; }
    .cp.no-radius .well, .cp.no-radius .hex { border-radius: 0; }
    .well input { opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    .hex { width: 92px; height: var(--ui-size-md); padding: 0 var(--ui-space-2); background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text);
      font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); outline: none; }
    .hex:focus { border-color: var(--ui-color-primary); }
    .swatches { display: flex; gap: 4px; }
    .sw { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--ui-color-border); cursor: pointer; padding: 0; }
    .sw:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiColorPicker), multi: true }],
})
export class UiColorPicker implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  radius = input<boolean>(this.config.radius);
  swatches = input<string[]>(['#3d5afe', '#2faa6e', '#d9a521', '#e5484d', '#8a8f98', '#e8eaed']);

  protected readonly value = signal('#3d5afe');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: string): void {
    this.value.set(v);
    this.onChange(v);
  }
}

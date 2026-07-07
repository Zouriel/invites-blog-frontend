import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-slider` — themed range slider (CVA). */
@Component({
  selector: 'ui-slider',
  template: `
    <div class="ui-slider">
      <input
        type="range"
        [min]="min()" [max]="max()" [step]="step()"
        [value]="value()"
        [disabled]="disabled()"
        [style.--ui-fill.%]="fillPct()"
        [attr.aria-label]="label()"
        (input)="handleInput($event)"
        (blur)="onTouched()" />
      @if (showValue()) { <span class="val">{{ value() }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-slider { display: flex; align-items: center; gap: var(--ui-space-3); }
    input[type=range] { flex: 1; appearance: none; height: 6px; border-radius: 999px; outline: none; cursor: pointer;
      background: linear-gradient(to right, var(--ui-color-primary) var(--ui-fill, 0%), var(--ui-color-surface-raised) var(--ui-fill, 0%)); }
    input[type=range]:disabled { opacity: 0.5; cursor: not-allowed; }
    input[type=range]::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; border-radius: 50%;
      background: #fff; border: 1px solid var(--ui-color-border); box-shadow: var(--ui-shadow-1); cursor: pointer; }
    input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 1px solid var(--ui-color-border); cursor: pointer; }
    input[type=range]:focus-visible { box-shadow: var(--ui-focus-ring); }
    .val { min-width: 2.5ch; text-align: right; font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSlider), multi: true }],
})
export class UiSlider implements ControlValueAccessor {
  min = input(0);
  max = input(100);
  step = input(1);
  label = input('Slider');
  showValue = input(true);

  protected readonly value = signal(0);
  protected readonly disabled = signal(false);
  private onChange: (v: number) => void = () => {};
  protected onTouched: () => void = () => {};

  protected readonly fillPct = computed(() => {
    const range = this.max() - this.min();
    return range <= 0 ? 0 : ((this.value() - this.min()) / range) * 100;
  });

  writeValue(v: number): void { this.value.set(v ?? this.min()); }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    this.value.set(v);
    this.onChange(v);
  }
}

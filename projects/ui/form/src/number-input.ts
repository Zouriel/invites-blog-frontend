import { Component, ElementRef, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

/** `ui-number-input` — numeric field with stepper buttons (CVA). */
@Component({
  selector: 'ui-number-input',
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <input
        class="ui-number"
        type="number"
        [attr.min]="min()" [attr.max]="max()" [attr.step]="step()"
        [attr.placeholder]="placeholder()"
        [attr.aria-invalid]="invalid() || null"
        #inp
        [value]="value()"
        [disabled]="disabled()"
        (input)="handleInput($event)"
        (blur)="onTouched()" />
      <div class="steppers">
        <button type="button" tabindex="-1" aria-label="Increment" [disabled]="disabled()" (click)="bump(step())">▲</button>
        <button type="button" tabindex="-1" aria-label="Decrement" [disabled]="disabled()" (click)="bump(-step())">▼</button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; display: flex; align-items: stretch;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .wrap:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .wrap.no-radius { border-radius: 0; }
    .ui-number {
      flex: 1; min-width: 0; appearance: textfield; -moz-appearance: textfield;
      height: var(--ui-size-md); padding: 0 var(--ui-space-3); border: none; background: transparent;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
    }
    .ui-number::-webkit-outer-spin-button, .ui-number::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .wrap[data-size="sm"] .ui-number { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-number { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .steppers { display: flex; flex-direction: column; border-left: 1px solid var(--ui-color-border); }
    .steppers button { flex: 1; width: 22px; border: none; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font-size: 8px; padding: 0; }
    .steppers button:first-child { border-bottom: 1px solid var(--ui-color-border); }
    .steppers button:hover:not(:disabled) { background: var(--ui-color-surface-raised); color: var(--ui-color-text); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiNumberInput), multi: true }],
})
export class UiNumberInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  min = input<number>();
  max = input<number>();
  step = input(1);
  placeholder = input('');
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);

  private readonly inp = viewChild<ElementRef<HTMLInputElement>>('inp');
  protected readonly value = signal<number | null>(null);
  protected readonly disabled = signal(false);
  private onChange: (v: number | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: number | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const v = raw === '' ? null : Number(raw);
    this.commit(v);
  }
  protected bump(delta: number): void {
    this.commit((this.value() ?? 0) + delta);
  }
  private commit(v: number | null): void {
    if (v !== null) {
      const min = this.min(), max = this.max();
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
    }
    this.value.set(v);
    // If the clamp result equals the current signal value, value.set() is a no-op and the [value]
    // binding won't re-write the input — so the DOM would keep the un-clamped text the user typed
    // (e.g. "1000" while the control holds 100). Force the displayed value to match.
    const el = this.inp()?.nativeElement;
    const display = v === null ? '' : String(v);
    if (el && el.value !== display) el.value = display;
    this.onChange(v);
  }
}

import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-rating` — star rating (CVA). */
@Component({
  selector: 'ui-rating',
  template: `
    <div class="ui-rating" role="radiogroup" [attr.aria-label]="label()">
      @for (i of stars(); track i) {
        <button
          type="button"
          class="star"
          [class.filled]="i <= (hover() || value())"
          role="radio"
          [attr.aria-checked]="i === value()"
          [attr.aria-label]="i + ' of ' + max()"
          [disabled]="disabled()"
          (click)="set(i)"
          (mouseenter)="hover.set(i)"
          (mouseleave)="hover.set(0)">★</button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .ui-rating { display: inline-flex; gap: 2px; }
    .star { border: none; background: none; cursor: pointer; padding: 0 1px; font-size: 20px; line-height: 1;
      color: var(--ui-color-border); transition: color var(--ui-motion-fast) var(--ui-ease-standard); }
    .star.filled { color: var(--ui-color-warning); }
    .star:disabled { cursor: not-allowed; }
    .star:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 4px; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiRating), multi: true }],
})
export class UiRating implements ControlValueAccessor {
  max = input(5);
  label = input('Rating');

  protected readonly value = signal(0);
  protected readonly hover = signal(0);
  protected readonly disabled = signal(false);
  private onChange: (v: number) => void = () => {};
  protected onTouched: () => void = () => {};

  protected stars(): number[] {
    return Array.from({ length: this.max() }, (_, i) => i + 1);
  }

  writeValue(v: number): void { this.value.set(v ?? 0); }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: number): void {
    const next = this.value() === v ? 0 : v;
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }
}

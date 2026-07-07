import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

/** `ui-time-picker` — time field (CVA; value is `HH:MM`), built on a native time input. */
@Component({
  selector: 'ui-time-picker',
  template: `
    <input
      class="ui-time"
      type="time"
      [class.no-radius]="!radius()"
      [attr.data-size]="size()"
      [attr.step]="step()"
      [value]="value()"
      [disabled]="disabled()"
      (input)="set($any($event.target).value)"
      (blur)="onTouched()" />
  `,
  styles: `
    :host { display: block; }
    .ui-time { width: 100%; box-sizing: border-box; height: var(--ui-size-md); padding: 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-time:focus { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .ui-time.no-radius { border-radius: 0; }
    .ui-time[data-size="sm"] { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .ui-time[data-size="lg"] { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .ui-time::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTimePicker), multi: true }],
})
export class UiTimePicker implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  size = input<UiSize>('md');
  /** Seconds granularity: 60 = minutes (default), 1 = show seconds. */
  step = input(60);
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: string): void { this.value.set(v); this.onChange(v); }
}

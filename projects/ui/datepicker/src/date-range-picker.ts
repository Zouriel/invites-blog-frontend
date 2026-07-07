import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export type UiDateRange = { start: string | null; end: string | null };

/** `ui-date-range-picker` — inline range selection (CVA; value is `{ start, end }` ISO strings). */
@Component({
  selector: 'ui-date-range-picker',
  template: `
    <div class="cal">
      <div class="head">
        <button type="button" class="nav" aria-label="Previous month" (click)="shift(-1)">‹</button>
        <span class="month">{{ MONTHS[view()[1]] }} {{ view()[0] }}</span>
        <button type="button" class="nav" aria-label="Next month" (click)="shift(1)">›</button>
      </div>
      <div class="weekdays">@for (w of weekdays; track w) { <span>{{ w }}</span> }</div>
      <div class="grid" role="grid">
        @for (b of leading(); track $index) { <span class="cell empty"></span> }
        @for (c of days(); track c.iso) {
          <button type="button" class="cell" [class.start]="c.iso === range().start" [class.end]="c.iso === range().end"
                  [class.inrange]="inRange(c.iso)" (click)="pick(c.iso)" (mouseenter)="hover.set(c.iso)">{{ c.day }}</button>
        }
      </div>
      <div class="foot">{{ range().start || '—' }} → {{ range().end || '—' }}</div>
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .cal { padding: var(--ui-space-3); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); width: 252px; font-family: var(--ui-font-default); }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--ui-space-2); }
    .month { font-weight: 600; font-size: var(--ui-font-size-sm); }
    .nav { width: 26px; height: 26px; border: none; background: transparent; color: var(--ui-color-text-muted); border-radius: 6px; cursor: pointer; }
    .nav:hover { background: var(--ui-color-surface-raised); color: var(--ui-color-text); }
    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .weekdays span { text-align: center; font-size: 11px; color: var(--ui-color-text-muted); padding: 2px 0; }
    .cell { aspect-ratio: 1; border: none; background: transparent; color: var(--ui-color-text); border-radius: 6px; cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm); }
    .cell.empty { cursor: default; }
    .cell:not(.empty):hover { background: var(--ui-color-surface-raised); }
    .cell.inrange { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); border-radius: 0; }
    .cell.start, .cell.end { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .foot { margin-top: var(--ui-space-2); font-size: 12px; color: var(--ui-color-text-muted); font-family: var(--ui-font-mono); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiDateRangePicker), multi: true }],
})
export class UiDateRangePicker implements ControlValueAccessor {
  protected readonly weekdays = WEEKDAYS;
  protected readonly MONTHS = MONTHS;
  protected readonly range = signal<UiDateRange>({ start: null, end: null });
  protected readonly hover = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly view = signal<[number, number]>([new Date().getFullYear(), new Date().getMonth()]);

  protected readonly leading = computed(() => Array.from({ length: new Date(this.view()[0], this.view()[1], 1).getDay() }));
  protected readonly days = computed(() => {
    const [y, m] = this.view();
    const count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => ({ day: i + 1, iso: iso(y, m, i + 1) }));
  });

  private onChange: (v: UiDateRange) => void = () => {};
  protected onTouched: () => void = () => {};
  writeValue(v: UiDateRange | null): void { this.range.set(v ?? { start: null, end: null }); }
  registerOnChange(fn: (v: UiDateRange) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected shift(delta: number): void { const d = new Date(this.view()[0], this.view()[1] + delta, 1); this.view.set([d.getFullYear(), d.getMonth()]); }
  protected inRange(d: string): boolean {
    const { start, end } = this.range();
    if (!start) return false;
    const hi = end ?? this.hover();
    if (!hi) return false;
    const lo = start < hi ? start : hi;
    const up = start < hi ? hi : start;
    return d > lo && d < up;
  }
  protected pick(d: string): void {
    const { start, end } = this.range();
    let next: UiDateRange;
    if (!start || (start && end)) next = { start: d, end: null };
    else next = d < start ? { start: d, end: start } : { start, end: d };
    this.range.set(next);
    this.onChange(next);
    if (next.end) this.onTouched();
  }
}

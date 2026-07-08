import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

interface DayCell { day: number; iso: string; today: boolean; }

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * `ui-date-picker` — calendar popover (CVA; value is an ISO `YYYY-MM-DD`
 * string). Backed by the CDK Overlay; closes on outside click / Escape.
 */
@Component({
  selector: 'ui-date-picker',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="wrap" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <input
        class="ui-date"
        readonly
        [attr.placeholder]="placeholder()"
        [value]="display()"
        [disabled]="disabled()"
        (click)="toggle()"
        (keydown.escape)="open.set(false)" />
      <span class="cal" aria-hidden="true">📅</span>
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="open.set(false)">
      <div class="cal-panel" (keydown.escape)="open.set(false)">
        <div class="cal-head">
          <button type="button" class="nav" [attr.aria-label]="prevLabel()" (click)="shift(-1)">‹</button>
          @if (mode() === 'days') {
            <span class="heading">
              <button type="button" class="lbl" (click)="mode.set('months')">{{ monthName() }}</button>
              <button type="button" class="lbl" (click)="mode.set('years')">{{ view()[0] }}</button>
            </span>
          } @else if (mode() === 'months') {
            <button type="button" class="lbl" (click)="mode.set('years')">{{ view()[0] }}</button>
          } @else {
            <span class="heading-static">{{ yearRange() }}</span>
          }
          <button type="button" class="nav" [attr.aria-label]="nextLabel()" (click)="shift(1)">›</button>
        </div>

        @if (mode() === 'days') {
          <div class="weekdays">
            @for (w of weekdays; track w) { <span class="wd">{{ w }}</span> }
          </div>
          <div class="grid" role="grid">
            @for (blank of leading(); track $index) { <span class="cell empty"></span> }
            @for (cell of days(); track cell.iso) {
              <button
                type="button"
                class="cell"
                [class.selected]="cell.iso === value()"
                [class.today]="cell.today"
                [attr.aria-selected]="cell.iso === value()"
                (click)="pick(cell.iso)">{{ cell.day }}</button>
            }
          </div>
        } @else if (mode() === 'months') {
          <div class="mgrid" role="grid">
            @for (mo of months; track mo.index) {
              <button
                type="button"
                class="mcell"
                [class.selected]="mo.index === view()[1]"
                (click)="pickMonth(mo.index)">{{ mo.short }}</button>
            }
          </div>
        } @else {
          <div class="mgrid" role="grid">
            @for (yr of years(); track yr) {
              <button
                type="button"
                class="mcell"
                [class.selected]="yr === view()[0]"
                (click)="pickYear(yr)">{{ yr }}</button>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    .ui-date { width: 100%; box-sizing: border-box; height: var(--ui-size-md);
      padding: 0 var(--ui-space-6) 0 var(--ui-space-3); cursor: pointer;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-date:focus { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .wrap.no-radius .ui-date { border-radius: 0; }
    .wrap[data-size="sm"] .ui-date { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-date { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .cal { position: absolute; right: var(--ui-space-3); top: 50%; transform: translateY(-50%); pointer-events: none; font-size: 13px; }
    .cal-panel { margin-top: var(--ui-space-1); padding: var(--ui-space-3);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); width: 252px; }
    .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--ui-space-2); }
    .heading { display: inline-flex; gap: 4px; }
    .heading-static { font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .lbl { border: none; background: transparent; color: var(--ui-color-text); font-weight: 600; font-size: var(--ui-font-size-sm);
      font-family: inherit; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
    .lbl:hover { background: var(--ui-color-surface); color: var(--ui-color-primary); }
    .nav { width: 26px; height: 26px; border: none; background: transparent; color: var(--ui-color-text-muted); border-radius: 6px; cursor: pointer; }
    .nav:hover { background: var(--ui-color-surface); color: var(--ui-color-text); }
    .mgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .mcell { border: none; background: transparent; color: var(--ui-color-text); font: inherit;
      font-size: var(--ui-font-size-sm); padding: 10px 0; border-radius: 6px; cursor: pointer; }
    .mcell:hover { background: var(--ui-color-surface); }
    .mcell.selected { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .wd { text-align: center; font-size: 11px; color: var(--ui-color-text-muted); padding: 2px 0; }
    .cell { aspect-ratio: 1; border: none; background: transparent; color: var(--ui-color-text);
      border-radius: 6px; cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm); }
    .cell.empty { background: none; cursor: default; }
    .cell:not(.empty):hover { background: var(--ui-color-surface); }
    .cell.today { box-shadow: inset 0 0 0 1px var(--ui-color-border); }
    .cell.selected { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .cell:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiDatePicker), multi: true }],
})
export class UiDatePicker implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  placeholder = input('Select a date');
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  protected readonly weekdays = WEEKDAYS;
  protected readonly months = MONTHS_SHORT.map((short, index) => ({ index, short }));
  // Which sub-view is showing: day grid, month grid, or year grid.
  protected readonly mode = signal<'days' | 'months' | 'years'>('days');
  // [year, monthIndex] currently displayed.
  protected readonly view = signal<[number, number]>(this.initialView());

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];

  protected readonly display = computed(() => {
    const v = this.value();
    if (!v) return '';
    const [y, m, d] = v.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  });
  protected readonly monthName = computed(() => MONTHS[this.view()[1]]);
  // Start year of the current 12-year page shown in the year grid.
  private readonly yearPageStart = computed(() => Math.floor(this.view()[0] / 12) * 12);
  protected readonly years = computed(() => {
    const start = this.yearPageStart();
    return Array.from({ length: 12 }, (_, i) => start + i);
  });
  protected readonly yearRange = computed(() => `${this.yearPageStart()} – ${this.yearPageStart() + 11}`);
  protected readonly prevLabel = computed(() =>
    this.mode() === 'days' ? 'Previous month' : this.mode() === 'months' ? 'Previous year' : 'Previous years');
  protected readonly nextLabel = computed(() =>
    this.mode() === 'days' ? 'Next month' : this.mode() === 'months' ? 'Next year' : 'Next years');
  protected readonly leading = computed(() => {
    const [y, m] = this.view();
    return Array.from({ length: new Date(y, m, 1).getDay() });
  });
  protected readonly days = computed<DayCell[]>(() => {
    const [y, m] = this.view();
    const count = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const cellIso = iso(y, m, d);
      return { day: d, iso: cellIso, today: cellIso === todayIso };
    });
  });

  private initialView(): [number, number] {
    const now = new Date();
    return [now.getFullYear(), now.getMonth()];
  }

  writeValue(v: string | null): void {
    this.value.set(v ?? null);
    if (v) {
      const [y, m] = v.split('-').map(Number);
      this.view.set([y, m - 1]);
    }
  }
  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected toggle(): void {
    const next = !this.open();
    if (next) this.mode.set('days');
    this.open.set(next);
  }
  // Prev/next stepping depends on the active sub-view: month, year, or 12-year page.
  protected shift(delta: number): void {
    const [y, m] = this.view();
    const mode = this.mode();
    if (mode === 'days') {
      const date = new Date(y, m + delta, 1);
      this.view.set([date.getFullYear(), date.getMonth()]);
    } else if (mode === 'months') {
      this.view.set([y + delta, m]);
    } else {
      this.view.set([y + delta * 12, m]);
    }
  }
  protected pickMonth(monthIndex: number): void {
    this.view.set([this.view()[0], monthIndex]);
    this.mode.set('days');
  }
  protected pickYear(year: number): void {
    this.view.set([year, this.view()[1]]);
    this.mode.set('months');
  }
  protected pick(isoDate: string): void {
    this.value.set(isoDate);
    this.onChange(isoDate);
    this.onTouched();
    this.open.set(false);
  }
}

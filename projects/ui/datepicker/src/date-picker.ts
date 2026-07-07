import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

interface DayCell { day: number; iso: string; today: boolean; }

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
        (click)="open.set(!open())"
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
          <button type="button" class="nav" aria-label="Previous month" (click)="shift(-1)">‹</button>
          <span class="month">{{ monthLabel() }}</span>
          <button type="button" class="nav" aria-label="Next month" (click)="shift(1)">›</button>
        </div>
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
    .month { font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .nav { width: 26px; height: 26px; border: none; background: transparent; color: var(--ui-color-text-muted); border-radius: 6px; cursor: pointer; }
    .nav:hover { background: var(--ui-color-surface); color: var(--ui-color-text); }
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
  // [year, monthIndex] currently displayed.
  private readonly view = signal<[number, number]>(this.initialView());

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
  protected readonly monthLabel = computed(() => `${MONTHS[this.view()[1]]} ${this.view()[0]}`);
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

  protected shift(delta: number): void {
    const [y, m] = this.view();
    const date = new Date(y, m + delta, 1);
    this.view.set([date.getFullYear(), date.getMonth()]);
  }
  protected pick(isoDate: string): void {
    this.value.set(isoDate);
    this.onChange(isoDate);
    this.onTouched();
    this.open.set(false);
  }
}

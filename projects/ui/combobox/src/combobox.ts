import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

export interface UiComboboxOption {
  label: string;
  value: string;
}

/**
 * `ui-combobox` — filterable autocomplete (CVA). Type to filter; Arrow keys +
 * Enter to choose; Escape to close. Backed by the CDK Overlay (WAI-ARIA combobox).
 */
@Component({
  selector: 'ui-combobox',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="wrap" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <input
        class="ui-combobox"
        role="combobox"
        [attr.aria-expanded]="open()"
        aria-autocomplete="list"
        [attr.placeholder]="placeholder()"
        [value]="query()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (focus)="open.set(true)"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()" />
      <span class="chevron" aria-hidden="true">▾</span>
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open() && filtered().length > 0"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayWidth]="triggerWidth()"
      (overlayOutsideClick)="open.set(false)">
      <ul class="panel" role="listbox">
        @for (opt of filtered(); track opt.value; let i = $index) {
          <li
            role="option"
            class="opt"
            [class.active]="i === activeIndex()"
            [attr.aria-selected]="opt.value === value()"
            (mousedown)="$event.preventDefault(); select(opt)"
            (mouseenter)="activeIndex.set(i)">
            {{ opt.label }}
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    .ui-combobox { width: 100%; box-sizing: border-box; height: var(--ui-size-md);
      padding: 0 var(--ui-space-6) 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-combobox:focus { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .wrap.no-radius .ui-combobox { border-radius: 0; }
    .wrap[data-size="sm"] .ui-combobox { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-combobox { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .chevron { position: absolute; right: var(--ui-space-3); top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--ui-color-text-muted); }
    .panel { margin: var(--ui-space-1) 0 0; padding: var(--ui-space-1); list-style: none; max-height: 240px; overflow: auto;
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); }
    .opt { padding: var(--ui-space-2) var(--ui-space-3); border-radius: 6px; cursor: pointer; color: var(--ui-color-text); font-size: var(--ui-font-size-md); }
    .opt.active { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    .opt[aria-selected="true"] { font-weight: 600; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCombobox), multi: true }],
})
export class UiCombobox implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  options = input<UiComboboxOption[]>([]);
  placeholder = input('Search…');
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);

  protected readonly query = signal('');
  protected readonly value = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly disabled = signal(false);
  protected readonly triggerWidth = signal<number | string>('auto');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(q));
  });

  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value.set(v ?? null);
    const match = this.options().find((o) => o.value === v);
    this.query.set(match ? match.label : '');
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.open.set(true);
    this.activeIndex.set(0);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const items = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); this.open.set(true); this.activeIndex.update((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIndex.update((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const opt = items[this.activeIndex()]; if (opt) this.select(opt); }
    else if (e.key === 'Escape') { this.open.set(false); }
  }

  protected select(opt: UiComboboxOption): void {
    this.value.set(opt.value);
    this.query.set(opt.label);
    this.open.set(false);
    this.onChange(opt.value);
  }

  protected onBlur(): void {
    this.onTouched();
    // Restore the selected label if the typed query doesn't match a selection.
    const match = this.options().find((o) => o.value === this.value());
    if (match && this.query() !== match.label) this.query.set(match.label);
  }
}

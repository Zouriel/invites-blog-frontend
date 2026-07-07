import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from 'ui';
import type { UiComboboxOption } from './combobox';

/** `ui-multi-select` — choose several options; selections shown as chips (CVA; value is string[]). */
@Component({
  selector: 'ui-multi-select',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="ms" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.no-radius]="!radius()" (click)="open.set(true)">
      @for (v of value(); track v) {
        <span class="chip">{{ labelOf(v) }}<button type="button" class="x" tabindex="-1" aria-label="Remove" (click)="toggle(v, $event)">×</button></span>
      }
      <input class="entry" [attr.placeholder]="value().length ? '' : placeholder()"
             [value]="query()" [disabled]="disabled()" (input)="onInput($event)" (focus)="open.set(true)" (blur)="onTouched()" />
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open() && filtered().length > 0"
                 [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayWidth]="width()" (overlayOutsideClick)="open.set(false)">
      <ul class="panel" role="listbox" aria-multiselectable="true">
        @for (opt of filtered(); track opt.value) {
          <li role="option" class="opt" [attr.aria-selected]="value().includes(opt.value)"
              (mousedown)="$event.preventDefault(); toggle(opt.value)">
            <span class="box">{{ value().includes(opt.value) ? '☑' : '☐' }}</span>{{ opt.label }}
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .ms { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); align-items: center; min-height: var(--ui-size-md);
      padding: 3px var(--ui-space-2); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); cursor: text; }
    .ms:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .ms.no-radius { border-radius: 0; }
    .chip { display: inline-flex; align-items: center; gap: 2px; height: 22px; padding: 0 var(--ui-space-2);
      background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); border: 1px solid var(--ui-color-primary);
      border-radius: 999px; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .x { border: none; background: none; color: inherit; cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
    .entry { flex: 1; min-width: 80px; border: none; background: transparent; outline: none; color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); height: 22px; }
    .panel { margin: var(--ui-space-1) 0 0; padding: var(--ui-space-1); list-style: none; max-height: 240px; overflow: auto;
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2); }
    .opt { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); border-radius: 6px;
      cursor: pointer; color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); }
    .opt:hover { background: color-mix(in srgb, var(--ui-color-primary) 14%, transparent); }
    .box { color: var(--ui-color-primary); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiMultiSelect), multi: true }],
})
export class UiMultiSelect implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  options = input<UiComboboxOption[]>([]);
  placeholder = input('Select…');
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal<string[]>([]);
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  protected readonly width = signal<number | string>('auto');
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  private onChange: (v: string[]) => void = () => {};
  protected onTouched: () => void = () => {};
  writeValue(v: string[]): void { this.value.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected labelOf(v: string): string { return this.options().find((o) => o.value === v)?.label ?? v; }
  protected onInput(e: Event): void { this.query.set((e.target as HTMLInputElement).value); this.open.set(true); }
  protected toggle(v: string, e?: Event): void {
    e?.stopPropagation();
    const next = this.value().includes(v) ? this.value().filter((x) => x !== v) : [...this.value(), v];
    this.value.set(next);
    this.onChange(next);
  }
}

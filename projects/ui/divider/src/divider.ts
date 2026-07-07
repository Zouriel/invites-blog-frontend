import { Component, input } from '@angular/core';

/** `ui-divider` — horizontal or vertical separator, optionally with a label. */
@Component({
  selector: 'ui-divider',
  template: `
    @if (label()) {
      <div class="labeled" role="separator" aria-orientation="horizontal">
        <span class="line"></span>
        <span class="label">{{ label() }}</span>
        <span class="line"></span>
      </div>
    } @else {
      <div class="bare" role="separator" [attr.aria-orientation]="orientation()"></div>
    }
  `,
  host: { '[attr.data-orientation]': 'orientation()' },
  styles: `
    :host { display: block; }
    :host([data-orientation="vertical"]) { display: inline-block; height: 100%; }
    .bare { background: var(--ui-color-border); }
    :host([data-orientation="horizontal"]) .bare { height: 1px; width: 100%; margin: var(--ui-space-3) 0; }
    :host([data-orientation="vertical"]) .bare { width: 1px; height: 100%; margin: 0 var(--ui-space-3); }
    .labeled { display: flex; align-items: center; gap: var(--ui-space-3); margin: var(--ui-space-3) 0; }
    .labeled .line { flex: 1; height: 1px; background: var(--ui-color-border); }
    .labeled .label { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); font-family: var(--ui-font-default); }
  `,
})
export class UiDivider {
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Optional centered label (horizontal only). */
  label = input<string>();
}

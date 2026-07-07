import { Component, inject, input, output } from '@angular/core';
import { UI_CONFIG, type UiStatus } from 'ui';

/** `ui-chip` — compact, optionally-removable tag/token. */
@Component({
  selector: 'ui-chip',
  template: `
    <span class="ui-chip" [attr.data-tone]="tone()" [class.no-radius]="!radius()">
      <ng-content />
      @if (removable()) {
        <button class="x" type="button" [attr.aria-label]="'Remove ' + (label() || 'chip')" (click)="remove.emit()">×</button>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-chip {
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      height: var(--ui-size-sm); padding: 0 var(--ui-space-3);
      border-radius: 999px; font-size: var(--ui-font-size-sm);
      font-family: var(--ui-font-default);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
    }
    .ui-chip.no-radius { border-radius: var(--ui-radius); }
    .ui-chip[data-tone="primary"] { background: color-mix(in srgb, var(--ui-color-primary) 22%, transparent); border-color: var(--ui-color-primary); }
    .ui-chip[data-tone="success"] { background: color-mix(in srgb, var(--ui-color-success) 22%, transparent); border-color: var(--ui-color-success); }
    .ui-chip[data-tone="warning"] { background: color-mix(in srgb, var(--ui-color-warning) 22%, transparent); border-color: var(--ui-color-warning); }
    .ui-chip[data-tone="danger"] { background: color-mix(in srgb, var(--ui-color-danger) 22%, transparent); border-color: var(--ui-color-danger); }
    .x {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; border: none; border-radius: 50%;
      background: transparent; color: inherit; cursor: pointer;
      font-size: 14px; line-height: 1;
    }
    .x:hover { background: rgba(127,127,127,0.25); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiChip {
  private config = inject(UI_CONFIG);
  tone = input<UiStatus>('neutral');
  removable = input(false);
  /** Used to build the remove button's accessible name. */
  label = input<string>();
  radius = input<boolean>(this.config.radius);
  remove = output<void>();
}

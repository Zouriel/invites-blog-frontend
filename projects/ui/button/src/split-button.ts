import { Component, inject, input, output } from '@angular/core';
import { UI_CONFIG, type UiSize } from 'ui';
import type { UiButtonVariant } from './button';

/**
 * `ui-split-button` — a primary action plus a caret that emits `(menu)` for an
 * attached dropdown. Project the main label as content.
 */
@Component({
  selector: 'ui-split-button',
  template: `
    <div class="split" [class.no-radius]="!radius()">
      <button class="main" [attr.data-variant]="variant()" [attr.data-size]="size()"
              [disabled]="disabled()" (click)="action.emit()">
        <ng-content />
      </button>
      <button class="caret" [attr.data-variant]="variant()" [attr.data-size]="size()"
              aria-label="More actions" aria-haspopup="menu"
              [disabled]="disabled()" (click)="menu.emit()">▾</button>
    </div>
  `,
  styles: `
    :host { display: inline-flex; }
    .split { display: inline-flex; }
    button { border: 1px solid var(--ui-color-border); background: var(--ui-color-surface); color: var(--ui-color-text);
      height: var(--ui-size-md); font-family: var(--ui-font-default); font-size: 14px; cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard); }
    button:hover:not(:disabled) { background: var(--ui-color-surface-raised); }
    button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); z-index: 1; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .main { padding: 0 var(--ui-space-4); border-radius: var(--ui-radius) 0 0 var(--ui-radius); }
    .caret { padding: 0 var(--ui-space-2); border-left: none; border-radius: 0 var(--ui-radius) var(--ui-radius) 0; }
    .split.no-radius .main, .split.no-radius .caret { border-radius: 0; }
    button[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    button[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    button[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; }
    button[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; }
  `,
})
export class UiSplitButton {
  private config = inject(UI_CONFIG);
  variant = input<UiButtonVariant>('primary');
  size = input<UiSize>('md');
  disabled = input(false);
  radius = input<boolean>(this.config.radius);
  action = output<void>();
  menu = output<void>();
}

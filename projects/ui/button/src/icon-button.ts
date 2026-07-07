import { Component, inject, input } from '@angular/core';
import { UI_CONFIG, type UiSize } from 'ui';
import type { UiButtonVariant } from './button';

/**
 * `ui-icon-button` — square, icon-only action. `label` is REQUIRED and applied
 * as `aria-label` so the control is named for assistive tech (WCAG).
 */
@Component({
  selector: 'ui-icon-button',
  template: `
    <button
      class="ui-icon-btn"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.round]="round()"
      [attr.type]="type()"
      [attr.data-variant]="variant()"
      [attr.data-size]="size()"
      [attr.aria-label]="label()"
      [disabled]="disabled()">
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-md); height: var(--ui-size-md);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-icon-btn:hover:not(:disabled) { filter: brightness(1.1); }
    .ui-icon-btn:active:not(:disabled) { transform: scale(0.94); }
    .ui-icon-btn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-icon-btn.no-radius { border-radius: 0; }
    .ui-icon-btn.round { border-radius: 999px; }
    .ui-icon-btn.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .ui-icon-btn[data-size="sm"] { width: var(--ui-size-sm); height: var(--ui-size-sm); }
    .ui-icon-btn[data-size="lg"] { width: var(--ui-size-lg); height: var(--ui-size-lg); }
    .ui-icon-btn[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="destructive"] { background: var(--ui-color-danger); color: #fff; border-color: transparent; }
    .ui-icon-btn[data-variant="ghost"] { background: transparent; border-color: transparent; }
    ::ng-content svg, ::slotted(svg) { width: 1.15em; height: 1.15em; }
  `,
})
export class UiIconButton {
  private config = inject(UI_CONFIG);
  /** Accessible name for the icon-only control (required for a11y). */
  label = input.required<string>();
  variant = input<UiButtonVariant>('ghost');
  size = input<UiSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  round = input(false);
  /** Opt-in glass treatment; solid by default (see UiButton). */
  glass = input(false);
  radius = input<boolean>(this.config.radius);
}

import { Component, input } from '@angular/core';

/** `ui-fab` — floating action button, fixed to a screen corner. `label` is required (a11y). */
@Component({
  selector: 'ui-fab',
  template: `
    <button class="ui-fab" [attr.data-position]="position()" [attr.data-size]="size()"
            [attr.aria-label]="label()" [disabled]="disabled()">
      <ng-content />
    </button>
  `,
  styles: `
    .ui-fab {
      position: fixed; z-index: var(--ui-z-docked);
      display: inline-flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      border: none; box-shadow: var(--ui-shadow-2); cursor: pointer; font-size: 22px;
      transition: transform var(--ui-motion-fast) var(--ui-ease-spring), background var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-fab:hover:not(:disabled) { background: var(--ui-color-primary-hover); transform: scale(1.05); }
    .ui-fab:active:not(:disabled) { transform: scale(0.96); }
    .ui-fab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring), var(--ui-shadow-2); }
    .ui-fab:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-fab[data-size="sm"] { width: 40px; height: 40px; font-size: 18px; }
    .ui-fab[data-position="bottom-right"] { right: var(--ui-space-6); bottom: var(--ui-space-6); }
    .ui-fab[data-position="bottom-left"] { left: var(--ui-space-6); bottom: var(--ui-space-6); }
    .ui-fab[data-position="top-right"] { right: var(--ui-space-6); top: var(--ui-space-6); }
    .ui-fab[data-position="top-left"] { left: var(--ui-space-6); top: var(--ui-space-6); }
  `,
})
export class UiFab {
  label = input.required<string>();
  position = input<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  size = input<'sm' | 'md'>('md');
  disabled = input(false);
}

import { Component, inject, input, model } from '@angular/core';
import { UI_CONFIG, type UiSize } from 'ui';

/** `ui-toggle-button` — two-state button (`aria-pressed`). Bind `[(pressed)]`. */
@Component({
  selector: 'ui-toggle-button',
  template: `
    <button
      class="ui-toggle"
      [class.pressed]="pressed()"
      [class.no-radius]="!radius()"
      [attr.data-size]="size()"
      [attr.aria-pressed]="pressed()"
      [disabled]="disabled()"
      (click)="toggle()">
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-toggle {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--ui-space-2);
      height: var(--ui-size-md); padding: 0 var(--ui-space-4);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: 14px; cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), border-color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-toggle:hover:not(:disabled) { background: var(--ui-color-surface-raised); }
    .ui-toggle.pressed { background: color-mix(in srgb, var(--ui-color-primary) 22%, transparent); border-color: var(--ui-color-primary); color: var(--ui-color-text); }
    .ui-toggle.no-radius { border-radius: 0; }
    .ui-toggle[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; padding: 0 var(--ui-space-3); }
    .ui-toggle[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; padding: 0 var(--ui-space-6); }
    .ui-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-toggle:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiToggleButton {
  private config = inject(UI_CONFIG);
  pressed = model(false);
  size = input<UiSize>('md');
  disabled = input(false);
  radius = input<boolean>(this.config.radius);

  protected toggle(): void {
    if (!this.disabled()) this.pressed.update((v) => !v);
  }
}

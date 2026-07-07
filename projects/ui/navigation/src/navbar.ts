import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from 'ui';

/**
 * `ui-navbar` — top navigation surface (glass-capable). Slots:
 * `[navbar-brand]`, default (center/links), `[navbar-actions]`.
 */
@Component({
  selector: 'ui-navbar',
  template: `
    <nav class="ui-navbar" [class.glass]="glass()" [class.no-radius]="!radius()" [class.sticky]="sticky()">
      <div class="brand"><ng-content select="[navbar-brand]" /></div>
      <div class="links"><ng-content /></div>
      <div class="actions"><ng-content select="[navbar-actions]" /></div>
    </nav>
  `,
  styles: `
    :host { display: block; }
    .ui-navbar {
      display: flex; align-items: center; gap: var(--ui-space-4);
      height: 52px; padding: 0 var(--ui-space-4);
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default);
    }
    .ui-navbar.no-radius { border-radius: 0; }
    .ui-navbar.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .ui-navbar.sticky { position: sticky; top: 0; z-index: var(--ui-z-docked); }
    .brand { font-weight: 700; color: var(--ui-color-text); display: flex; align-items: center; gap: var(--ui-space-2); }
    .links { display: flex; align-items: center; gap: var(--ui-space-2); flex: 1; }
    .actions { display: flex; align-items: center; gap: var(--ui-space-2); }
  `,
})
export class UiNavbar {
  private config = inject(UI_CONFIG);
  sticky = input(false);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
}

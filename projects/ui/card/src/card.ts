import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from 'ui';

/**
 * `ui-card` — surface container with optional header/footer slots.
 * Project header content with `[card-header]` and footer with `[card-footer]`.
 */
@Component({
  selector: 'ui-card',
  template: `
    <div class="ui-card" [class.glass]="glass()" [class.no-radius]="!radius()" [attr.data-pad]="padding()">
      <div class="hd"><ng-content select="[card-header]" /></div>
      <div class="bd"><ng-content /></div>
      <div class="ft"><ng-content select="[card-footer]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-card {
      display: flex; flex-direction: column;
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }
    .ui-card.no-radius { border-radius: 0; }
    .ui-card.glass {
      background: var(--ui-glass-bg);
      backdrop-filter: blur(var(--ui-glass-blur));
      border-color: var(--ui-glass-border);
    }
    .hd, .bd, .ft { padding: var(--ui-space-3) var(--ui-space-4); }
    .ui-card[data-pad="sm"] .hd, .ui-card[data-pad="sm"] .bd, .ui-card[data-pad="sm"] .ft { padding: var(--ui-space-2) var(--ui-space-3); }
    .ui-card[data-pad="lg"] .hd, .ui-card[data-pad="lg"] .bd, .ui-card[data-pad="lg"] .ft { padding: var(--ui-space-4) var(--ui-space-6); }
    .hd { border-bottom: 1px solid var(--ui-color-border); font-weight: 600; }
    .ft { border-top: 1px solid var(--ui-color-border); }
    /* Collapse empty header/footer slots */
    .hd:empty, .ft:empty { display: none; }
  `,
})
export class UiCard {
  private config = inject(UI_CONFIG);
  padding = input<'sm' | 'md' | 'lg'>('md');
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
}

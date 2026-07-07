import { Component, input } from '@angular/core';

/** `ui-container` — centered, max-width content wrapper with responsive padding. */
@Component({
  selector: 'ui-container',
  template: `<div class="ui-container" [attr.data-size]="size()"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ui-container { margin-inline: auto; padding-inline: var(--ui-space-4); width: 100%; box-sizing: border-box; }
    .ui-container[data-size="sm"] { max-width: 640px; }
    .ui-container[data-size="md"] { max-width: 860px; }
    .ui-container[data-size="lg"] { max-width: 1100px; }
    .ui-container[data-size="xl"] { max-width: 1320px; }
    .ui-container[data-size="full"] { max-width: none; }
  `,
})
export class UiContainer {
  size = input<'sm' | 'md' | 'lg' | 'xl' | 'full'>('lg');
}

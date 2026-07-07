import { Component, input } from '@angular/core';

/** `ui-scroll-area` — themed, thin-scrollbar scroll container with a fixed max height. */
@Component({
  selector: 'ui-scroll-area',
  template: `<div class="sa" [style.max-height]="maxHeight()" [style.--ui-sa-axis]="axis()"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .sa { overflow: auto; scrollbar-width: thin; scrollbar-color: var(--ui-color-border) transparent; }
    .sa::-webkit-scrollbar { width: 9px; height: 9px; }
    .sa::-webkit-scrollbar-thumb { background: var(--ui-color-border); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
    .sa::-webkit-scrollbar-thumb:hover { background: var(--ui-color-text-muted); background-clip: padding-box; }
    .sa::-webkit-scrollbar-track { background: transparent; }
  `,
})
export class UiScrollArea {
  maxHeight = input('240px');
  axis = input<'y' | 'x' | 'both'>('y');
}

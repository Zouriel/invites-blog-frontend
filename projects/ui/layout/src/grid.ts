import { Component, computed, input } from '@angular/core';

type Gap = 1 | 2 | 3 | 4 | 6;

/** `ui-grid` — CSS grid with a fixed column count and token-based gap. */
@Component({
  selector: 'ui-grid',
  template: `<div class="ui-grid" [style.grid-template-columns]="cols()" [style.gap]="gapVar()"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ui-grid { display: grid; }
  `,
})
export class UiGrid {
  /** Column count, or a CSS grid-template-columns string. */
  columns = input<number | string>(12);
  /** Minimum column width for an auto-fit responsive grid (overrides columns). */
  min = input<string>();
  gap = input<Gap>(4);

  protected readonly cols = computed(() => {
    const min = this.min();
    if (min) return `repeat(auto-fit, minmax(${min}, 1fr))`;
    const c = this.columns();
    return typeof c === 'number' ? `repeat(${c}, 1fr)` : c;
  });
  protected readonly gapVar = computed(() => `var(--ui-space-${this.gap()})`);
}

import { Component, computed, input } from '@angular/core';

type Gap = 0 | 1 | 2 | 3 | 4 | 6;

/** `ui-stack` — flexbox row/column with token gap and alignment. */
@Component({
  selector: 'ui-stack',
  template: `<div class="ui-stack" [style.flex-direction]="direction()" [style.gap]="gapVar()"
                  [style.align-items]="align()" [style.justify-content]="justify()"
                  [style.flex-wrap]="wrap() ? 'wrap' : 'nowrap'"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ui-stack { display: flex; }
  `,
})
export class UiStack {
  direction = input<'row' | 'column'>('column');
  gap = input<Gap>(3);
  align = input<'start' | 'center' | 'end' | 'stretch'>('stretch');
  justify = input<'start' | 'center' | 'end' | 'space-between'>('start');
  wrap = input(false);

  protected readonly gapVar = computed(() => `var(--ui-space-${this.gap()}, 0px)`);
}

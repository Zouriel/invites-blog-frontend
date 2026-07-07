import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, input, TemplateRef } from '@angular/core';

/**
 * `ui-virtual-list` — renders only the visible slice of a large list via the
 * CDK virtual scroll. Provide an item template:
 *
 *   <ui-virtual-list [items]="rows" [itemSize]="32" height="320px">
 *     <ng-template let-item>{{ item.name }}</ng-template>
 *   </ui-virtual-list>
 */
@Component({
  selector: 'ui-virtual-list',
  imports: [ScrollingModule, NgTemplateOutlet],
  template: `
    <cdk-virtual-scroll-viewport [itemSize]="itemSize()" [style.height]="height()" class="vp">
      <div *cdkVirtualFor="let item of items()" [style.height.px]="itemSize()" class="row">
        <ng-container [ngTemplateOutlet]="tpl()!" [ngTemplateOutletContext]="{ $implicit: item }" />
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    :host { display: block; }
    .vp { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .row { display: flex; align-items: center; padding: 0 var(--ui-space-3); box-sizing: border-box;
      border-bottom: 1px solid var(--ui-color-border); font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
  `,
})
export class UiVirtualList<T = unknown> {
  items = input<T[]>([]);
  itemSize = input(32);
  height = input('320px');
  protected readonly tpl = contentChild(TemplateRef);
}

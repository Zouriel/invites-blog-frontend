import { NgTemplateOutlet } from '@angular/common';
import { Component, input, model, output, signal } from '@angular/core';

export interface UiTreeNode {
  label: string;
  value: string;
  icon?: string;
  children?: UiTreeNode[];
}

/** `ui-tree` — expandable hierarchy with selection (recursive, WAI-ARIA tree). */
@Component({
  selector: 'ui-tree',
  imports: [NgTemplateOutlet],
  template: `
    <div class="tree" role="tree">
      @for (n of nodes(); track n.value) {
        <ng-container [ngTemplateOutlet]="node" [ngTemplateOutletContext]="{ $implicit: n, depth: 0 }" />
      }
    </div>
    <ng-template #node let-n let-depth="depth">
      <div class="row" role="treeitem" [attr.aria-expanded]="n.children?.length ? expanded().has(n.value) : null"
           [class.selected]="n.value === selected()" [style.padding-left.px]="8 + depth * 16" (click)="choose(n)">
        @if (n.children?.length) {
          <button type="button" class="chev" [class.open]="expanded().has(n.value)" (click)="toggle(n, $event)" aria-label="Toggle">›</button>
        } @else { <span class="chev spacer"></span> }
        @if (n.icon) { <span class="icon">{{ n.icon }}</span> }
        <span class="label">{{ n.label }}</span>
      </div>
      @if (n.children?.length && expanded().has(n.value)) {
        @for (c of n.children; track c.value) {
          <ng-container [ngTemplateOutlet]="node" [ngTemplateOutletContext]="{ $implicit: c, depth: depth + 1 }" />
        }
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .tree { font-family: var(--ui-font-default); }
    .row { display: flex; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      cursor: pointer; border-radius: 6px; color: var(--ui-color-text); font-size: var(--ui-font-size-md); }
    .row:hover { background: var(--ui-color-surface-raised); }
    .row.selected { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    .chev { width: 18px; height: 18px; flex: none; border: none; background: none; color: var(--ui-color-text-muted); cursor: pointer;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard); transform: rotate(0deg); }
    .chev.open { transform: rotate(90deg); }
    .chev.spacer { cursor: default; }
    .icon { font-size: 14px; }
    .label { flex: 1; }
  `,
})
export class UiTree {
  nodes = input<UiTreeNode[]>([]);
  selected = model<string | null>(null);
  nodeSelect = output<UiTreeNode>();
  protected readonly expanded = signal<Set<string>>(new Set());

  protected toggle(n: UiTreeNode, e: Event): void {
    e.stopPropagation();
    const next = new Set(this.expanded());
    next.has(n.value) ? next.delete(n.value) : next.add(n.value);
    this.expanded.set(next);
  }
  protected choose(n: UiTreeNode): void {
    this.selected.set(n.value);
    this.nodeSelect.emit(n);
  }
}

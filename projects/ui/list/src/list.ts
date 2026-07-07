import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';

/** `ui-list` — semantic list container. Project `ui-list-item` children. */
@Component({
  selector: 'ui-list',
  template: `<div class="ui-list" [class.bordered]="bordered()" role="list"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ui-list { display: flex; flex-direction: column; font-family: var(--ui-font-default); }
    .ui-list.bordered { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .ui-list.bordered ::ng-deep ui-list-item:not(:last-child) .ui-list-item { border-bottom: 1px solid var(--ui-color-border); }
  `,
})
export class UiList {
  bordered = input(false);
}

/** `ui-list-item` — a row in `ui-list`. Optional `[item-leading]` / `[item-trailing]` slots. */
@Component({
  selector: 'ui-list-item',
  imports: [NgTemplateOutlet],
  template: `
    @if (interactive()) {
      <button
        type="button"
        class="ui-list-item interactive"
        role="listitem"
        [class.selected]="selected()"
        [disabled]="disabled()"
        (click)="activate.emit()">
        <ng-container [ngTemplateOutlet]="body" />
      </button>
    } @else {
      <div class="ui-list-item" role="listitem">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }
    <!-- Single set of projection slots, stamped into whichever wrapper is active. -->
    <ng-template #body>
      <span class="lead"><ng-content select="[item-leading]" /></span>
      <span class="main"><ng-content /></span>
      <span class="trail"><ng-content select="[item-trailing]" /></span>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .ui-list-item {
      display: flex; align-items: center; gap: var(--ui-space-3); width: 100%;
      padding: var(--ui-space-2) var(--ui-space-4); box-sizing: border-box;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      text-align: left; background: transparent;
    }
    .ui-list-item.interactive { border: none; cursor: pointer; transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    .ui-list-item.interactive:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); }
    .ui-list-item.interactive:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-list-item.selected { background: color-mix(in srgb, var(--ui-color-primary) 20%, transparent); }
    .ui-list-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .lead:empty, .trail:empty { display: none; }
    .main { flex: 1; min-width: 0; }
    .trail { color: var(--ui-color-text-muted); }
  `,
})
export class UiListItem {
  interactive = input(false);
  selected = input(false);
  disabled = input(false);
  activate = output<void>();
}

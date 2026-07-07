import { Component } from '@angular/core';

/** `ui-kbd` — keyboard key hint. */
@Component({
  selector: 'ui-kbd',
  template: `<kbd class="ui-kbd"><ng-content /></kbd>`,
  styles: `
    :host { display: inline-flex; }
    .ui-kbd {
      display: inline-flex; align-items: center; min-width: 1.4em; height: 1.5em;
      padding: 0 0.4em; box-sizing: border-box;
      font-family: var(--ui-font-mono); font-size: 0.82em; line-height: 1;
      color: var(--ui-color-text);
      background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border);
      border-bottom-width: 2px; border-radius: 5px;
    }
  `,
})
export class UiKbd {}

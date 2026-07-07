import { Component } from '@angular/core';

/** `ui-inline-code` — inline code token. */
@Component({
  selector: 'ui-inline-code',
  template: `<code class="ui-code"><ng-content /></code>`,
  styles: `
    :host { display: inline; }
    .ui-code {
      font-family: var(--ui-font-mono); font-size: 0.88em;
      padding: 0.1em 0.35em; border-radius: 5px;
      color: var(--ui-color-text);
      background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border);
    }
  `,
})
export class UiInlineCode {}

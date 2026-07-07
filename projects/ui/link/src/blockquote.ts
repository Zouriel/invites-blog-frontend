import { Component, input } from '@angular/core';

/** `ui-blockquote` — quotation block with optional citation. */
@Component({
  selector: 'ui-blockquote',
  template: `
    <blockquote class="ui-quote">
      <ng-content />
      @if (cite()) { <footer class="cite">— {{ cite() }}</footer> }
    </blockquote>
  `,
  styles: `
    :host { display: block; }
    .ui-quote {
      margin: 0; padding: var(--ui-space-2) var(--ui-space-4);
      border-left: 3px solid var(--ui-color-primary);
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-style: italic;
    }
    .cite { margin-top: var(--ui-space-1); font-style: normal; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
  `,
})
export class UiBlockquote {
  cite = input<string>();
}

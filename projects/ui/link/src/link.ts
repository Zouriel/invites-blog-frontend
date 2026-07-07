import { Component, input } from '@angular/core';

/** `ui-link` — themed anchor. External links get safe rel + a visual marker. */
@Component({
  selector: 'ui-link',
  template: `
    <a
      class="ui-link"
      [attr.href]="href()"
      [attr.target]="external() ? '_blank' : null"
      [attr.rel]="external() ? 'noopener noreferrer' : null"
      [attr.data-tone]="tone()">
      <ng-content />
      @if (external()) { <span class="ext" aria-hidden="true">↗</span> }
    </a>
  `,
  styles: `
    :host { display: inline; }
    .ui-link {
      color: var(--ui-color-primary); text-decoration: none;
      font-family: var(--ui-font-default); cursor: pointer;
      border-radius: 3px;
      transition: color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-link:hover { text-decoration: underline; color: var(--ui-color-primary-hover); }
    .ui-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-link[data-tone="muted"] { color: var(--ui-color-text-muted); }
    .ui-link[data-tone="plain"] { color: inherit; }
    .ext { font-size: 0.85em; }
  `,
})
export class UiLink {
  href = input<string>();
  external = input(false);
  tone = input<'primary' | 'muted' | 'plain'>('primary');
}

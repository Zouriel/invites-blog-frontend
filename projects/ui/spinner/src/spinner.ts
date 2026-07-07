import { Component, input } from '@angular/core';
import type { UiSize } from 'ui';

/** `ui-spinner` — indeterminate activity indicator. */
@Component({
  selector: 'ui-spinner',
  template: `<span class="ui-spinner" [attr.data-size]="size()" role="status" [attr.aria-label]="label()"></span>`,
  styles: `
    :host { display: inline-flex; }
    .ui-spinner {
      display: inline-block; box-sizing: border-box;
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid var(--ui-color-border);
      border-top-color: var(--ui-color-primary);
      animation: ui-spinner-rot var(--ui-motion-slow) linear infinite;
    }
    .ui-spinner[data-size="sm"] { width: 14px; height: 14px; }
    .ui-spinner[data-size="lg"] { width: 32px; height: 32px; border-width: 3px; }
    @keyframes ui-spinner-rot { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ui-spinner { animation-duration: 1.2s; } }
  `,
})
export class UiSpinner {
  size = input<UiSize>('md');
  label = input('Loading');
}

import { Component, input } from '@angular/core';
import type { UiStatus } from 'ui';

/** `ui-badge` — small status/count label. */
@Component({
  selector: 'ui-badge',
  template: `<span class="ui-badge" [attr.data-tone]="tone()" [class.dot]="dot()"><ng-content /></span>`,
  styles: `
    :host { display: inline-flex; }
    .ui-badge {
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      height: 20px; padding: 0 var(--ui-space-2);
      border-radius: 999px;
      font-size: 12px; font-weight: 600; line-height: 1;
      font-family: var(--ui-font-default);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
    }
    .ui-badge.dot { width: 8px; height: 8px; padding: 0; }
    .ui-badge[data-tone="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-badge[data-tone="success"] { background: var(--ui-color-success); color: #fff; border-color: transparent; }
    .ui-badge[data-tone="warning"] { background: var(--ui-color-warning); color: #1a1d23; border-color: transparent; }
    .ui-badge[data-tone="danger"] { background: var(--ui-color-danger); color: #fff; border-color: transparent; }
  `,
})
export class UiBadge {
  tone = input<UiStatus>('neutral');
  /** Render as a bare status dot (no content). */
  dot = input(false);
}

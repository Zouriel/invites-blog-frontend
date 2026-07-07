import { Component, computed, input } from '@angular/core';
import type { UiStatus } from 'ui';

/**
 * `ui-progress-bar` — determinate or indeterminate progress.
 * Set `value` (0–100) for determinate; omit/null for indeterminate.
 */
@Component({
  selector: 'ui-progress-bar',
  template: `
    <div
      class="track"
      [attr.data-tone]="tone()"
      role="progressbar"
      [attr.aria-valuenow]="indeterminate() ? null : pct()"
      [attr.aria-valuemin]="indeterminate() ? null : 0"
      [attr.aria-valuemax]="indeterminate() ? null : 100"
      [attr.aria-label]="label()">
      <div class="fill" [class.indeterminate]="indeterminate()" [style.width.%]="indeterminate() ? null : pct()"></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .track {
      position: relative; height: 8px; width: 100%;
      background: var(--ui-color-surface-raised);
      border-radius: 999px; overflow: hidden;
    }
    .fill {
      height: 100%; background: var(--ui-color-primary);
      border-radius: inherit;
      transition: width var(--ui-motion-base) var(--ui-ease-standard);
    }
    .track[data-tone="success"] .fill { background: var(--ui-color-success); }
    .track[data-tone="warning"] .fill { background: var(--ui-color-warning); }
    .track[data-tone="danger"] .fill { background: var(--ui-color-danger); }
    .fill.indeterminate {
      width: 40%;
      animation: ui-progress-indeterminate 1.2s var(--ui-ease-standard) infinite;
    }
    @keyframes ui-progress-indeterminate {
      0% { margin-left: -40%; }
      100% { margin-left: 100%; }
    }
    @media (prefers-reduced-motion: reduce) { .fill.indeterminate { animation-duration: 2.4s; } }
  `,
})
export class UiProgressBar {
  value = input<number | null>(null);
  tone = input<UiStatus>('primary');
  label = input('Progress');

  protected readonly indeterminate = computed(() => this.value() === null || this.value() === undefined);
  protected readonly pct = computed(() => Math.max(0, Math.min(100, this.value() ?? 0)));
}

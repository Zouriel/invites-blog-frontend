import { Component, inject, input, output } from '@angular/core';
import { UI_CONFIG } from 'ui';

export type UiAlertTone = 'info' | 'success' | 'warning' | 'danger';

/** `ui-alert` — inline contextual message. Uses role="alert" for danger/warning. */
@Component({
  selector: 'ui-alert',
  template: `
    <div
      class="ui-alert"
      [attr.data-tone]="tone()"
      [class.no-radius]="!radius()"
      [attr.role]="tone() === 'danger' || tone() === 'warning' ? 'alert' : 'status'">
      <span class="icon" aria-hidden="true">{{ glyph[tone()] }}</span>
      <div class="content">
        @if (heading()) { <strong class="title">{{ heading() }}</strong> }
        <div class="body"><ng-content /></div>
      </div>
      @if (dismissible()) {
        <button class="x" type="button" aria-label="Dismiss" (click)="dismiss.emit()">×</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-alert {
      display: flex; gap: var(--ui-space-3); align-items: flex-start;
      padding: var(--ui-space-2) var(--ui-space-3);
      border: 1px solid var(--ui-color-border); border-left-width: 3px;
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface);
      color: var(--ui-color-text); font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-md);
    }
    .ui-alert.no-radius { border-radius: 0; }
    .icon { font-size: 1.1em; line-height: 1.4; }
    .content { flex: 1; min-width: 0; }
    .title { display: block; margin-bottom: 2px; }
    .body { color: var(--ui-color-text-muted); }
    .ui-alert[data-tone="info"]    { border-left-color: var(--ui-color-primary); }
    .ui-alert[data-tone="success"] { border-left-color: var(--ui-color-success); }
    .ui-alert[data-tone="warning"] { border-left-color: var(--ui-color-warning); }
    .ui-alert[data-tone="danger"]  { border-left-color: var(--ui-color-danger); }
    .x { border: none; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font-size: 18px; line-height: 1; padding: 0 4px; }
    .x:hover { color: var(--ui-color-text); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 4px; }
  `,
})
export class UiAlert {
  private config = inject(UI_CONFIG);
  tone = input<UiAlertTone>('info');
  heading = input<string>();
  dismissible = input(false);
  radius = input<boolean>(this.config.radius);
  dismiss = output<void>();

  protected readonly glyph: Record<UiAlertTone, string> = {
    info: 'ℹ', success: '✓', warning: '⚠', danger: '✕',
  };
}

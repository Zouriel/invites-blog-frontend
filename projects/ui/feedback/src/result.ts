import { Component, input } from '@angular/core';

export type UiResultStatus = 'success' | 'error' | 'info' | 'warning' | '404' | '500';

/** `ui-result` — full-page outcome state (success / error / 404 / 500). */
@Component({
  selector: 'ui-result',
  template: `
    <div class="ui-result">
      <div class="glyph" [attr.data-status]="status()" aria-hidden="true">{{ glyph[status()] }}</div>
      <div class="title">{{ title() }}</div>
      @if (subtitle()) { <div class="subtitle">{{ subtitle() }}</div> }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-result {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: var(--ui-space-2); padding: var(--ui-space-6); font-family: var(--ui-font-default);
    }
    .glyph {
      display: flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 50%; font-size: 28px;
      background: var(--ui-color-surface-raised);
    }
    .glyph[data-status="success"] { color: var(--ui-color-success); }
    .glyph[data-status="error"], .glyph[data-status="500"] { color: var(--ui-color-danger); }
    .glyph[data-status="warning"] { color: var(--ui-color-warning); }
    .glyph[data-status="info"], .glyph[data-status="404"] { color: var(--ui-color-primary); }
    .title { font-size: var(--ui-font-size-lg); font-weight: 600; color: var(--ui-color-text); margin-top: var(--ui-space-2); }
    .subtitle { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); max-width: 420px; }
    .actions { display: flex; gap: var(--ui-space-2); margin-top: var(--ui-space-3); }
    .actions:empty { display: none; }
  `,
})
export class UiResult {
  status = input<UiResultStatus>('info');
  title = input('');
  subtitle = input<string>();
  protected readonly glyph: Record<UiResultStatus, string> = {
    success: '✓', error: '✕', info: 'ℹ', warning: '⚠', '404': '?', '500': '!',
  };
}

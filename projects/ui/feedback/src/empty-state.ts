import { Component, input } from '@angular/core';

/** `ui-empty-state` — placeholder for empty content. Slots: `[empty-icon]`, `[empty-actions]`. */
@Component({
  selector: 'ui-empty-state',
  template: `
    <div class="ui-empty">
      <div class="icon"><ng-content select="[empty-icon]" /></div>
      <div class="title">{{ heading() }}</div>
      @if (description()) { <div class="desc">{{ description() }}</div> }
      <div class="actions"><ng-content select="[empty-actions]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-empty {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: var(--ui-space-2); padding: var(--ui-space-6) var(--ui-space-4);
      font-family: var(--ui-font-default);
    }
    .icon { font-size: 32px; line-height: 1; color: var(--ui-color-text-muted); }
    .icon:empty { display: none; }
    .title { font-size: var(--ui-font-size-md); font-weight: 600; color: var(--ui-color-text); }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); max-width: 360px; }
    .actions { display: flex; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .actions:empty { display: none; }
  `,
})
export class UiEmptyState {
  heading = input('Nothing here yet');
  description = input<string>();
}

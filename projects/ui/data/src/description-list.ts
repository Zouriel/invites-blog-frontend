import { Component, input } from '@angular/core';

export interface UiDescriptionItem {
  term: string;
  detail: string;
}

/** `ui-description-list` — key/value pairs (a semantic `<dl>`). */
@Component({
  selector: 'ui-description-list',
  template: `
    <dl class="ui-dl" [class.row]="layout() === 'row'">
      @for (item of items(); track $index) {
        <div class="pair">
          <dt>{{ item.term }}</dt>
          <dd>{{ item.detail }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; }
    .ui-dl { margin: 0; display: flex; flex-direction: column; gap: var(--ui-space-2); font-family: var(--ui-font-default); }
    .pair { display: flex; flex-direction: column; gap: 2px; }
    .ui-dl.row .pair { flex-direction: row; gap: var(--ui-space-4); }
    .ui-dl.row dt { min-width: 140px; }
    dt { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); margin: 0; }
    dd { margin: 0; font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
  `,
})
export class UiDescriptionList {
  items = input<UiDescriptionItem[]>([]);
  layout = input<'stacked' | 'row'>('row');
}

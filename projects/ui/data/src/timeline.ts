import { Component, input } from '@angular/core';
import type { UiStatus } from 'ui';

export interface UiTimelineItem {
  title: string;
  description?: string;
  meta?: string;
  tone?: UiStatus;
}

/** `ui-timeline` — vertical sequence of events with connector line. */
@Component({
  selector: 'ui-timeline',
  template: `
    <ol class="ui-timeline">
      @for (item of items(); track $index) {
        <li class="event">
          <span class="dot" [attr.data-tone]="item.tone || 'primary'" aria-hidden="true"></span>
          <div class="body">
            <div class="row">
              <span class="title">{{ item.title }}</span>
              @if (item.meta) { <span class="meta">{{ item.meta }}</span> }
            </div>
            @if (item.description) { <div class="desc">{{ item.description }}</div> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    .ui-timeline { margin: 0; padding: 0; list-style: none; font-family: var(--ui-font-default); }
    .event { position: relative; display: flex; gap: var(--ui-space-3); padding-bottom: var(--ui-space-4); }
    .event:last-child { padding-bottom: 0; }
    .event::before { content: ''; position: absolute; left: 5px; top: 14px; bottom: 0; width: 1px; background: var(--ui-color-border); }
    .event:last-child::before { display: none; }
    .dot { width: 11px; height: 11px; border-radius: 50%; flex: none; margin-top: 3px; background: var(--ui-color-primary); box-shadow: 0 0 0 2px var(--ui-color-bg); z-index: 1; }
    .dot[data-tone="success"] { background: var(--ui-color-success); }
    .dot[data-tone="warning"] { background: var(--ui-color-warning); }
    .dot[data-tone="danger"] { background: var(--ui-color-danger); }
    .dot[data-tone="neutral"] { background: var(--ui-color-secondary); }
    .row { display: flex; align-items: baseline; gap: var(--ui-space-2); }
    .title { font-size: var(--ui-font-size-md); color: var(--ui-color-text); font-weight: 500; }
    .meta { font-size: 12px; color: var(--ui-color-text-muted); }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); margin-top: 2px; }
  `,
})
export class UiTimeline {
  items = input<UiTimelineItem[]>([]);
}

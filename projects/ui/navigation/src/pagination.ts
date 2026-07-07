import { Component, computed, input, model } from '@angular/core';

/** `ui-pagination` — page navigation with truncation and prev/next. */
@Component({
  selector: 'ui-pagination',
  template: `
    <nav class="ui-pagination" [attr.aria-label]="label()">
      <button type="button" class="pg" [disabled]="page() <= 1" aria-label="Previous page" (click)="go(page() - 1)">‹</button>
      @for (item of items(); track $index) {
        @if (item === -1) {
          <span class="ellipsis" aria-hidden="true">…</span>
        } @else {
          <button
            type="button"
            class="pg"
            [class.active]="item === page()"
            [attr.aria-current]="item === page() ? 'page' : null"
            [attr.aria-label]="'Page ' + item"
            (click)="go(item)">
            {{ item }}
          </button>
        }
      }
      <button type="button" class="pg" [disabled]="page() >= total()" aria-label="Next page" (click)="go(page() + 1)">›</button>
    </nav>
  `,
  styles: `
    :host { display: block; }
    .ui-pagination { display: inline-flex; align-items: center; gap: var(--ui-space-1); font-family: var(--ui-font-default); }
    .pg {
      min-width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0 var(--ui-space-2);
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font: inherit; font-size: var(--ui-font-size-sm); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .pg:hover:not(:disabled):not(.active) { background: var(--ui-color-surface-raised); }
    .pg.active { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .pg:disabled { opacity: 0.4; cursor: not-allowed; }
    .pg:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ellipsis { padding: 0 var(--ui-space-1); color: var(--ui-color-text-muted); }
  `,
})
export class UiPagination {
  page = model(1);
  total = input(1);
  /** Sibling pages to show around current. */
  siblings = input(1);
  label = input('Pagination');

  protected readonly items = computed<number[]>(() => {
    const total = this.total();
    const current = this.page();
    const sib = this.siblings();
    const range: number[] = [];
    const left = Math.max(2, current - sib);
    const right = Math.min(total - 1, current + sib);
    range.push(1);
    if (left > 2) range.push(-1);
    for (let i = left; i <= right; i++) range.push(i);
    if (right < total - 1) range.push(-1);
    if (total > 1) range.push(total);
    return range;
  });

  protected go(p: number): void {
    const clamped = Math.max(1, Math.min(this.total(), p));
    if (clamped !== this.page()) this.page.set(clamped);
  }
}

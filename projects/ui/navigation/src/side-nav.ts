import { Component, input, model, output } from '@angular/core';

export interface UiSideNavItem {
  label: string;
  value: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
}
export interface UiSideNavGroup {
  label?: string;
  items: UiSideNavItem[];
}

/**
 * `ui-side-nav` — vertical, grouped navigation rail (docs/app sidebar). Bind
 * `[(active)]` to the selected value and listen to `(navigate)`. Router-
 * agnostic: map the emitted item to a route yourself.
 */
@Component({
  selector: 'ui-side-nav',
  template: `
    <nav class="ui-side-nav" [attr.aria-label]="label()">
      @for (group of groups(); track $index) {
        <div class="group">
          @if (group.label) { <div class="group-label">{{ group.label }}</div> }
          <ul role="list">
            @for (item of group.items; track item.value) {
              <li>
                <button
                  type="button"
                  class="item"
                  [class.active]="item.value === active()"
                  [attr.aria-current]="item.value === active() ? 'page' : null"
                  [disabled]="item.disabled"
                  (click)="choose(item)">
                  @if (item.icon) { <span class="icon" aria-hidden="true">{{ item.icon }}</span> }
                  <span class="label">{{ item.label }}</span>
                  @if (item.badge != null) { <span class="badge">{{ item.badge }}</span> }
                </button>
              </li>
            }
          </ul>
        </div>
      }
    </nav>
  `,
  styles: `
    :host { display: block; }
    .ui-side-nav { display: flex; flex-direction: column; gap: var(--ui-space-4); font-family: var(--ui-font-default); }
    .group { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .group-label { font-family: var(--ui-font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em;
      color: var(--ui-color-text-muted); padding: 0 var(--ui-space-2); margin-bottom: 2px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
    .item { position: relative; display: flex; align-items: center; gap: var(--ui-space-2); width: 100%;
      padding: var(--ui-space-1) var(--ui-space-3); background: none; border: none; border-radius: 7px;
      color: var(--ui-color-text-muted); font: inherit; font-size: var(--ui-font-size-sm); text-align: left; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .item:hover:not(:disabled) { background: var(--ui-color-surface-raised); color: var(--ui-color-text); }
    .item.active { background: color-mix(in srgb, var(--ui-color-primary) 16%, transparent); color: var(--ui-color-text); font-weight: 600; }
    .item.active::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; border-radius: 2px; background: var(--ui-color-primary); }
    .item:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .item:disabled { opacity: 0.5; cursor: not-allowed; }
    .icon { width: 18px; text-align: center; }
    .label { flex: 1; min-width: 0; }
    .badge { font-size: 10px; font-family: var(--ui-font-mono); padding: 1px 6px; border-radius: 999px;
      background: var(--ui-color-surface-raised); color: var(--ui-color-text-muted); }
  `,
})
export class UiSideNav {
  groups = input<UiSideNavGroup[]>([]);
  active = model<string>('');
  label = input('Sidebar');
  navigate = output<UiSideNavItem>();

  protected choose(item: UiSideNavItem): void {
    if (item.disabled) return;
    this.active.set(item.value);
    this.navigate.emit(item);
  }
}

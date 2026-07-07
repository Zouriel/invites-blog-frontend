import {
  Component, ElementRef, contentChildren, effect, inject, input, model, signal,
} from '@angular/core';

let tabSeq = 0;

/**
 * `ui-tab` — a single tab + its panel. Provide a `label` and project the panel
 * content. Inactive panels stay in the DOM but are hidden (`[hidden]`).
 */
@Component({
  selector: 'ui-tab',
  template: `
    <div
      role="tabpanel"
      [id]="panelId"
      [attr.aria-labelledby]="tabId"
      [hidden]="!active()"
      tabindex="0">
      <ng-content />
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class UiTab {
  label = input.required<string>();
  disabled = input(false);
  readonly active = signal(false);
  readonly tabId = `ui-tab-${tabSeq}`;
  readonly panelId = `ui-tabpanel-${tabSeq++}`;
}

/**
 * `ui-tabs` — WAI-ARIA tabs. Wraps `ui-tab` children; renders a tablist with
 * roving tabindex and Arrow/Home/End keyboard navigation.
 */
@Component({
  selector: 'ui-tabs',
  template: `
    <div class="tablist" role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.tabId; let i = $index) {
        <button
          type="button"
          role="tab"
          class="tab"
          [id]="tab.tabId"
          [attr.aria-controls]="tab.panelId"
          [attr.aria-selected]="selectedIndex() === i"
          [attr.tabindex]="selectedIndex() === i ? 0 : -1"
          [disabled]="tab.disabled()"
          (click)="select(i)"
          (keydown)="onKeydown($event, i)">
          {{ tab.label() }}
        </button>
      }
    </div>
    <ng-content />
  `,
  styles: `
    :host { display: block; }
    .tablist { display: flex; gap: var(--ui-space-1); border-bottom: 1px solid var(--ui-color-border); margin-bottom: var(--ui-space-4); }
    .tab {
      position: relative; appearance: none; border: none; background: transparent;
      padding: var(--ui-space-2) var(--ui-space-3); margin-bottom: -1px;
      color: var(--ui-color-text-muted); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      cursor: pointer; border-bottom: 2px solid transparent;
      transition: color var(--ui-motion-base) var(--ui-ease-standard), border-color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .tab:hover:not(:disabled) { color: var(--ui-color-text); }
    .tab[aria-selected="true"] { color: var(--ui-color-text); border-bottom-color: var(--ui-color-primary); }
    .tab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 6px; }
    .tab:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class UiTabs {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  selectedIndex = model(0);
  label = input<string>('Tabs');
  readonly tabs = contentChildren(UiTab);

  constructor() {
    effect(() => {
      const tabs = this.tabs();
      const sel = this.selectedIndex();
      tabs.forEach((t, i) => t.active.set(i === sel));
    });
  }

  protected select(i: number): void {
    if (this.tabs()[i]?.disabled()) return;
    this.selectedIndex.set(i);
  }

  protected onKeydown(e: KeyboardEvent, i: number): void {
    const count = this.tabs().length;
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % count;
    else if (e.key === 'ArrowLeft') next = (i - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    this.select(next);
    const buttons = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.tab');
    buttons[next]?.focus();
  }
}

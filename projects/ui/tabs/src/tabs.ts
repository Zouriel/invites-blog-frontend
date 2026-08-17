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
    /* More tabs than fit is normal on a phone, so the strip SCROLLS rather than pushing the page
       sideways — a tablist wide enough to overflow the viewport takes the whole layout with it. */
    .tablist {
      display: flex;
      gap: var(--ui-space-1);
      border-bottom: 1px solid var(--ui-color-border);
      margin-bottom: var(--ui-space-4);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      /* The strip is navigable by tab, arrow keys and swipe; a scrollbar under it is just noise. */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .tablist::-webkit-scrollbar { display: none; }
    .tab {
      position: relative; appearance: none; border: none; background: transparent;
      padding: var(--ui-space-2) var(--ui-space-3); margin-bottom: -1px;
      color: var(--ui-color-text-muted); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      cursor: pointer; border-bottom: 2px solid transparent;
      /* Never shrink or wrap: a two-line "Audit log" is how a tab strip starts looking broken. */
      flex: 0 0 auto;
      white-space: nowrap;
      scroll-snap-align: start;
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
      this.revealSelected(sel);
    });
  }

  /**
   * Keeps the selected tab visible when the strip is scrolled. Selection can move without a click —
   * arrow keys, or the host setting selectedIndex — and a selected tab off-screen reads as nothing
   * being selected at all.
   */
  private revealSelected(index: number): void {
    const strip = this.host.nativeElement.querySelector('.tablist');
    const tab = strip?.children.item(index) as HTMLElement | null;
    if (!strip || !tab) return;
    if (strip.scrollWidth <= strip.clientWidth) return;
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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

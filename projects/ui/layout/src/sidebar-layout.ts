import { Component, effect, inject, input, model, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * `ui-sidebar-layout` — responsive application shell. A fixed sidebar beside a
 * scrolling main column on desktop; below `breakpoint` the sidebar becomes an
 * off-canvas drawer toggled by a built-in hamburger, over a dimmed backdrop.
 *
 * Project the nav into `[sidebar]`, the top-bar content into `[header]`, and the
 * page into the default slot:
 *
 *   <ui-sidebar-layout [breakpoint]="860">
 *     <my-nav sidebar></my-nav>
 *     <h1 header>Page title</h1>
 *     <router-outlet></router-outlet>
 *   </ui-sidebar-layout>
 *
 * Bind `[(open)]` to drive the mobile drawer yourself (e.g. close it on
 * navigation), or call `close()`. The breakpoint is driven by `matchMedia`, not
 * a hardcoded CSS `@media`, so it stays configurable per app.
 */
@Component({
  selector: 'ui-sidebar-layout',
  host: {
    '[class.ui-compact]': 'compact()',
    '[class.ui-open]': 'open()',
    '[style.--ui-sb-w]': 'sidebarWidth()',
  },
  template: `
    <div class="backdrop" (click)="open.set(false)"></div>
    <aside class="sidebar"><ng-content select="[sidebar]" /></aside>
    <div class="main">
      <header class="bar">
        @if (compact()) {
          <button type="button" class="burger" aria-label="Toggle navigation"
                  [attr.aria-expanded]="open()" (click)="toggle()">
            <span></span><span></span><span></span>
          </button>
        }
        <ng-content select="[header]" />
      </header>
      <main class="content"><ng-content /></main>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--ui-sb-w, 248px) 1fr;
      min-height: 100vh;
      font-family: var(--ui-font-default);
    }
    .backdrop { display: none; }
    .sidebar {
      background: var(--ui-color-surface);
      border-right: 1px solid var(--ui-color-border);
      min-width: 0; overflow-y: auto;
    }
    .main { display: flex; flex-direction: column; min-width: 0; }
    .bar {
      display: flex; align-items: center; gap: var(--ui-space-3);
      min-height: var(--ui-size-lg);
      padding: var(--ui-space-3) var(--ui-space-6);
      border-bottom: 1px solid var(--ui-color-border);
      background: var(--ui-color-bg);
      position: sticky; top: 0; z-index: 5;
    }
    .content { min-width: 0; padding: var(--ui-shell-pad, var(--ui-space-6)); }

    .burger {
      display: inline-flex; flex-direction: column; justify-content: center; gap: 4px;
      width: var(--ui-size-md); height: var(--ui-size-md);
      padding: 0 7px; background: none; border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); cursor: pointer; flex: none;
    }
    .burger span { display: block; height: 2px; border-radius: 2px; background: var(--ui-color-text); transition: opacity var(--ui-motion-fast) var(--ui-ease-standard); }
    .burger:hover { background: var(--ui-color-surface-raised); }
    .burger:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    /* Compact mode — toggled by the matchMedia-driven host class. */
    :host(.ui-compact) { grid-template-columns: 1fr; }
    :host(.ui-compact) .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0;
      width: var(--ui-sb-w, 248px); max-width: 84vw; z-index: 30;
      padding: var(--ui-space-3);
      transform: translateX(-100%);
      transition: transform var(--ui-motion-base) var(--ui-ease-standard);
    }
    :host(.ui-compact.ui-open) .sidebar { transform: translateX(0); box-shadow: var(--ui-shadow-2); }
    :host(.ui-compact.ui-open) .backdrop {
      display: block; position: fixed; inset: 0; z-index: 20;
      background: rgba(0, 0, 0, 0.55);
    }
    :host(.ui-compact) .bar { padding: var(--ui-space-3) var(--ui-space-4); }
    :host(.ui-compact) .content { padding: var(--ui-shell-pad, var(--ui-space-4)); }

    @media (prefers-reduced-motion: reduce) {
      .sidebar { transition: none; }
    }
  `,
})
export class UiSidebarLayout {
  /** Max viewport width (px) at which the sidebar collapses into a drawer. */
  breakpoint = input(860);
  /** Sidebar width (any CSS length). */
  sidebarWidth = input('248px');
  /** Two-way: whether the mobile drawer is open. Ignored above the breakpoint. */
  open = model(false);

  /** True while below the breakpoint (drawer mode). */
  protected compact = signal(false);

  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect((onCleanup) => {
        const mql = window.matchMedia(`(max-width: ${this.breakpoint()}px)`);
        const apply = () => {
          this.compact.set(mql.matches);
          if (!mql.matches) this.open.set(false); // never leave a stale drawer open on desktop
        };
        apply();
        mql.addEventListener('change', apply);
        onCleanup(() => mql.removeEventListener('change', apply));
      });
    }
  }

  /** Toggle the mobile drawer. */
  toggle(): void { this.open.update((o) => !o); }
  /** Close the mobile drawer (call on navigation). */
  close(): void { this.open.set(false); }
}

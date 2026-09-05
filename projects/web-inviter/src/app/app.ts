import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { SessionStore } from './shared/services/session.store';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { UiToastHost } from '@zouriel/ui/dialog';
import { UiSwipe } from '@zouriel/ui/behaviors';
import { clearStaleBuildMarker } from './shared/utils/stale-build';
import { UiScrollProgress } from '@zouriel/ui/fx';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { TabRail } from './shared/services/tab-rail';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, UiToastHost, UiScrollProgress, UiSwipe],
  template: `
    <ui-scroll-progress />
    <app-header />
    <!-- The swipe is the bottom bar's gesture — the same handful of screens, walked instead of
         aimed at — so it is armed only where that bar is: signed in, and on a screen the rail
         actually contains. Everywhere else it is inert and a drag is just a drag. -->
    <main
      #main
      class="app-main"
      uiSwipe
      [uiSwipeDisabled]="!rail.active()"
      (uiSwipeLeft)="swipe(1)"
      (uiSwipeRight)="swipe(-1)"
    >
      <router-outlet />
    </main>
    @if (!isSignedIn()) {
      <app-footer />
    }
    <ui-toast-host position="bottom-right" />
  `,
  host: { '[class.has-tabs]': 'isSignedIn()' },
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
      }
      .app-main {
        flex: 1;
      }
      /* The signed-in bottom bar is fixed, so it sits over whatever the page ends with. Reserve its
         height (plus the phone's home indicator) or the last row of every list is unreachable —
         which on the dashboard is a guest, and on the photo box a photograph.

         This used to pad the footer, which was the last thing on the page. Signed in there is no
         footer any more, so the room has to be made by the content itself. */
      :host(.has-tabs) .app-main {
        padding-bottom: calc(56px + env(safe-area-inset-bottom));
      }
    `,
  ],
})
export class App {
  private readonly router = inject(Router);
  protected readonly isSignedIn = inject(SessionStore).isSignedIn;
  protected readonly rail = inject(TabRail);

  private readonly main = viewChild<ElementRef<HTMLElement>>('main');

  constructor() {
    // A navigation that completes proves this tab is on a build whose chunks still exist, so the
    // one-shot stale-build reload guard can be released for the next deploy.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) clearStaleBuildMarker();
    });
  }

  protected swipe(step: 1 | -1): void {
    void this.rail.go(step);
    this.slide(step);
  }

  /**
   * The new screen arrives from the side the finger came from.
   *
   * <p>Short and small on purpose: it is not a page transition, it is the acknowledgement that the
   * gesture landed. Without one the screen simply changes and a swipe is indistinguishable from a
   * misfire. Anyone who has asked for less motion gets none of it.</p>
   */
  private slide(step: 1 | -1): void {
    const el = this.main()?.nativeElement;
    if (!el?.animate) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { transform: `translateX(${step * 24}px)`, opacity: 0.35 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }
}

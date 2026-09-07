import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SessionStore } from './shared/services/session.store';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { UiToastHost } from '@zouriel/ui/dialog';
import { UiSwipe } from '@zouriel/ui/behaviors';
import { clearStaleBuildMarker } from './shared/utils/stale-build';
import { UiScrollProgress } from '@zouriel/ui/fx';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { TabRail } from './shared/services/tab-rail';
import { ApiService } from './shared/api/api.service';

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
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  protected readonly isSignedIn = this.session.isSignedIn;
  protected readonly rail = inject(TabRail);

  constructor() {
    // A navigation that completes proves this tab is on a build whose chunks still exist, so the
    // one-shot stale-build reload guard can be released for the next deploy.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) clearStaleBuildMarker();
    });

    this.refreshSession();
  }

  /**
   * Takes a fresh token on start, so a role granted since this browser last signed in takes effect.
   *
   * <p>Permissions are claims inside the token. Without this, an admin making somebody an admin —
   * or a subscriber — changed nothing they could see or do until they happened to sign out and back
   * in, and no screen anywhere said so. A failure is ignored on purpose: the token in hand still
   * works, and an expired one is the route guards' business, not a reason to interrupt a page.</p>
   */
  private refreshSession(): void {
    if (!this.session.isSignedIn()) return;
    this.api.refreshSession().subscribe({
      next: ({ token, account }) => this.session.set(token, account),
      error: () => {},
    });
  }

  /**
   * A swipe is the bottom bar's gesture, so it lands the way the bar does: at once, with nothing
   * moving.
   *
   * <p>There was a 24px slide here to acknowledge the gesture. It had to go, and not only because
   * it read as a lurch. A positive `translateX` on a full-width element EXTENDS the document's
   * scrollable overflow — measured at 390 -> 414px — so on the way to the next screen the browser
   * genuinely panned the page sideways and sprang it back, while the finger was still down. Going
   * back translated the other way, made no overflow, and behaved: one direction glitched and the
   * other did not.</p>
   *
   * <p>No cue is needed anyway. The screen's content changes and the tab strip's marker moves, which
   * is the same acknowledgement tapping the bar gives — and now the two are identical.</p>
   */
  protected swipe(step: 1 | -1): void {
    void this.rail.go(step);
  }
}

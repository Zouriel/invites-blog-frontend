import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SessionStore } from './shared/services/session.store';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { UiToastHost } from '@zouriel/ui/dialog';
import { clearStaleBuildMarker } from './shared/utils/stale-build';
import { UiScrollProgress } from '@zouriel/ui/fx';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, UiToastHost, UiScrollProgress],
  template: `
    <ui-scroll-progress />
    <app-header />
    <main class="app-main">
      <router-outlet />
    </main>
    <app-footer />
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
         which on the dashboard is a guest, and on the photo box a photograph. */
      :host(.has-tabs) app-footer {
        padding-bottom: calc(56px + env(safe-area-inset-bottom));
      }
    `,
  ],
})
export class App {
  private readonly router = inject(Router);
  protected readonly isSignedIn = inject(SessionStore).isSignedIn;

  constructor() {
    // A navigation that completes proves this tab is on a build whose chunks still exist, so the
    // one-shot stale-build reload guard can be released for the next deploy.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) clearStaleBuildMarker();
    });
  }
}

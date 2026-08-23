import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { UiToastHost } from '@zouriel/ui/dialog';
import { clearStaleBuildMarker } from './shared/utils/stale-build';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <ui-toast-host />
  `,
})
export class App {
  private readonly router = inject(Router);

  constructor() {
    // A navigation that completes proves this tab is on a build whose chunks still exist, so the
    // one-shot stale-build reload guard can be released for the next deploy.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) clearStaleBuildMarker();
    });
  }
}

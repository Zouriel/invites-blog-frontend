import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { BROWSER_LOCATION, HostSplit, safeNext } from '../../shared/services/host-split';
import { SessionHandoffService } from '../../shared/services/session-handoff.service';

/**
 * `/handoff`, a page that only passes through (SessionHandoffService):
 * - on invites.blog, `?next=/feed`: hands this browser's sign-in (if any) to app.invites.blog and goes there;
 * - on app.invites.blog, `#code=…&next=…`: takes the sign-in over and opens `next`.
 * With one host for everything (staging, local) there is nothing to hand over: it opens `next`.
 */
@Component({
  selector: 'app-handoff',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiSpinner, UiText],
  template: `
    <section class="wrap">
      <ui-spinner />
      <ui-text variant="body">Opening invites.blog…</ui-text>
    </section>
  `,
  styles: `
    .wrap {
      min-height: 60vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-4);
    }
  `,
})
export class HandoffComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly split = inject(HostSplit);
  private readonly handoff = inject(SessionHandoffService);
  private readonly location = inject(BROWSER_LOCATION);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.split.onSite()) {
      await this.handoff.goToApp(safeNext(this.route.snapshot.queryParamMap.get('next')) ?? '/feed', true);
      return;
    }
    const current = this.location.current();
    const hash = current.includes('#') ? current.slice(current.indexOf('#')) : '';
    // The code leaves the address bar (and the history) before anything else happens.
    history.replaceState(history.state, '', '/handoff');
    const next = this.split.onApp()
      ? await this.handoff.receive(hash)
      : (safeNext(this.route.snapshot.queryParamMap.get('next')) ?? '/');
    await this.router.navigateByUrl(next, { replaceUrl: true });
  }
}

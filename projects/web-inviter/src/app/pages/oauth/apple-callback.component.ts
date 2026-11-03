import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { AppleWebSignInService } from '../../shared/services/apple-web-sign-in.service';
import { SessionStore } from '../../shared/services/session.store';

/**
 * Where Sign in with Apple ends. The API handled Apple's return (https://invites.blog/auth/apple/callback)
 * and sent the browser here with a one-time code in the fragment; this swaps it for the session and goes
 * on exactly as a Google sign-in does: to where they were headed, else the feed.
 */
@Component({
  selector: 'app-apple-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiSpinner, UiText],
  template: `
    <section class="wrap">
      <ui-spinner />
      <ui-text variant="body">Finishing sign-in…</ui-text>
    </section>
  `,
  styles: `
    .wrap {
      min-height: 60vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }
  `,
})
export class AppleCallbackComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly apple = inject(AppleWebSignInService);

  constructor() {
    const code = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('code');
    // The code leaves the address bar (and history) straight away; it is single-use anyway.
    history.replaceState(history.state, '', window.location.pathname);
    const next = this.apple.takeNext();

    if (!code) {
      void this.router.navigate(['/login'], { queryParams: { appleError: 'apple_handoff' }, replaceUrl: true });
      return;
    }
    this.api.appleWebRedeem(code).subscribe({
      next: (res) => {
        this.session.set(res.token, res.account);
        void this.router.navigateByUrl(next || '/feed', { replaceUrl: true });
      },
      error: () =>
        void this.router.navigate(['/login'], {
          queryParams: { appleError: 'apple_handoff', ...(next ? { next } : {}) },
          replaceUrl: true,
        }),
    });
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HostSplit } from '../../shared/services/host-split';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';

/**
 * The provider redirects the sign-in popup here with the ID token in the URL fragment. This page's
 * only job is to hand it back to the window that opened it and close — it never talks to our API,
 * so a stray visit to this URL does nothing.
 *
 * This exact path is what must be registered as the provider's redirect URI:
 * <c>https://invites.blog/oauth/callback</c>. The web app on app.invites.blog uses this same page, so
 * the result is posted to whichever of our own origins opened the popup.
 */
@Component({
  selector: 'app-oauth-callback',
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
export class OAuthCallbackComponent {
  constructor() {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const message = {
      source: 'ib-oauth',
      idToken: fragment.get('id_token') ?? undefined,
      state: fragment.get('state') ?? undefined,
      error: fragment.get('error_description') ?? fragment.get('error') ?? undefined,
    };

    // Post back to our own origins only (a message whose target origin doesn't match the opener is
    // dropped by the browser); the opener validates the state before trusting it.
    for (const origin of inject(HostSplit).trustedOrigins()) {
      try {
        window.opener?.postMessage(message, origin);
      } catch {
        /* not that origin */
      }
    }
    window.close();
  }
}

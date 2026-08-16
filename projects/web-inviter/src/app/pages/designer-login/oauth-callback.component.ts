import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';

/**
 * The provider redirects the sign-in popup here with the ID token in the URL fragment. This page's
 * only job is to hand it back to the window that opened it and close — it never talks to our API,
 * so a stray visit to this URL does nothing.
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

    // Post back to our own origin only; the opener validates the state before trusting it.
    window.opener?.postMessage(message, window.location.origin);
    window.close();
  }
}

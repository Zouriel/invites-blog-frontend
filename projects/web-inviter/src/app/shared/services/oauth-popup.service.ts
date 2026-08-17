import { Injectable } from '@angular/core';
import { ExternalAuthProvider } from '../utils/types/api.types';

/**
 * Runs the OpenID Connect implicit sign-in dance in a popup and resolves with the provider's ID
 * token. No SDK and no client secret: we ask the provider for `response_type=id_token`, it redirects
 * the popup back to `/oauth/callback` with the token in the URL fragment, and that page posts it
 * back here. The SERVER then verifies the token's signature — nothing the popup returns is trusted
 * on its own.
 */
@Injectable({ providedIn: 'root' })
export class OAuthPopupService {
  /** Where the provider sends the popup back to. Must be registered with the provider. */
  static redirectUri(): string {
    return `${window.location.origin}/oauth/callback`;
  }

  signIn(provider: ExternalAuthProvider): Promise<string> {
    const nonce = OAuthPopupService.random();
    const state = OAuthPopupService.random();

    const params = new URLSearchParams({
      client_id: provider.clientId,
      response_type: 'id_token',
      // response_mode=fragment keeps the token out of server logs and the Referer header.
      response_mode: 'fragment',
      scope: 'openid email profile',
      redirect_uri: OAuthPopupService.redirectUri(),
      nonce,
      state,
      prompt: 'select_account',
    });

    const popup = window.open(
      `${provider.authorizeUrl}?${params.toString()}`,
      'ib-oauth',
      'width=520,height=640,menubar=no,toolbar=no',
    );
    if (!popup) {
      return Promise.reject(new Error('Your browser blocked the sign-in window. Allow pop-ups and try again.'));
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        clearInterval(closedTimer);
        try {
          popup.close();
        } catch {
          /* already closed */
        }
        fn();
      };

      const onMessage = (event: MessageEvent) => {
        // Only ever trust a message from our own origin — the callback page is ours.
        if (event.origin !== window.location.origin) return;
        const data = event.data as { source?: string; idToken?: string; state?: string; error?: string };
        if (data?.source !== 'ib-oauth') return;

        // A mismatched state means this isn't the response to the request we just made.
        if (data.state !== state) {
          finish(() => reject(new Error('That sign-in response did not match this request.')));
          return;
        }
        if (data.error || !data.idToken) {
          finish(() => reject(new Error(data.error || 'Sign-in was cancelled.')));
          return;
        }
        const token = data.idToken;
        finish(() => resolve(token));
      };

      window.addEventListener('message', onMessage);

      // The popup closing without a message means the user gave up.
      const closedTimer = window.setInterval(() => {
        if (popup.closed) finish(() => reject(new Error('Sign-in was cancelled.')));
      }, 500);
    });
  }

  private static random(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}

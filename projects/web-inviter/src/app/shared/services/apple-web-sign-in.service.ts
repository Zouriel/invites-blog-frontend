import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';

/** Where the page was headed, kept across the trip to Apple (a full-page redirect loses the URL). */
const NEXT_KEY = 'ib.apple.next';

/**
 * Sign in with Apple on the website. Unlike Google's popup this is a full-page redirect, so it works
 * where popups are blocked (in-app browsers, many phones):
 * 1. `start()` asks the server for Apple's authorize URL (the server keeps the state and nonce in an
 *    HttpOnly cookie) and goes there.
 * 2. Apple posts the result to https://invites.blog/auth/apple/callback, which the API handles: it checks
 *    the state, signs in exactly as the app does, and redirects to `/oauth/apple#code=…`.
 * 3. That page redeems the one-time code for the session (`AppleCallbackComponent`).
 * No token ever sits in a URL; the code is single-use and only works in this browser.
 */
@Injectable({ providedIn: 'root' })
export class AppleWebSignInService {
  private readonly api = inject(ApiService);

  /** Leaves the page for Apple. Rejects (with a message to show) when the server won't start it. */
  async start(next: string | null): Promise<void> {
    try {
      if (next) sessionStorage.setItem(NEXT_KEY, next);
      else sessionStorage.removeItem(NEXT_KEY);
    } catch {
      /* storage off: they land on the feed instead */
    }
    const { authorizeUrl } = await firstValueFrom(this.api.appleWebStart());
    this.navigate(authorizeUrl);
  }

  /** Where to go after signing in (only an in-app path), once; null when nothing was kept. */
  takeNext(): string | null {
    try {
      const next = sessionStorage.getItem(NEXT_KEY);
      sessionStorage.removeItem(NEXT_KEY);
      return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    } catch {
      return null;
    }
  }

  /** A seam for tests: leaving the page can't be undone inside a test runner. */
  navigate(url: string): void {
    window.location.assign(url);
  }
}

/**
 * What to tell someone the API sent back to /login with `?appleError=<word>`. Only fixed words are
 * shown: the URL is anyone's to craft, so it never supplies the text itself.
 */
export function appleErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'apple_cancelled':
      return null;
    case 'apple_web_off':
      return "Sign in with Apple isn't available on the website right now. Use another way to sign in.";
    case 'apple_state':
    case 'apple_handoff':
      return 'That Apple sign-in expired or was started in another window. Please try again.';
    case 'oauth_no_email':
      return "Apple didn't share an email address. On your Apple ID's Sign in with Apple settings, remove invites.blog and try again.";
    case 'oauth_email_unverified':
      return "There's already an account with this email. Sign in to it another way; Apple hasn't confirmed the address.";
    default:
      return "Apple sign-in didn't work. Please try again, or use another way to sign in.";
  }
}

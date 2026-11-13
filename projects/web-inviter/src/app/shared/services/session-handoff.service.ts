import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import { SessionStore } from './session.store';
import { BROWSER_LOCATION, HOST_CONFIG, HostSplit, pathOf, safeNext } from './host-split';

/** Set on app.invites.blog once it has asked invites.blog for a sign-in, so it asks only once. */
export const HANDOFF_CHECKED_KEY = 'ib_handoff_checked';

/** Pages of the app that must never be sent away to look for a sign-in. */
const NO_BOUNCE = ['/handoff', '/oauth/callback', '/oauth/apple'];

/**
 * Carries a sign-in from invites.blog to app.invites.blog (they are two hosts since 2026-11-13, and a
 * browser keeps each host's storage apart, so the session saved on invites.blog is invisible to the app).
 *
 * <p>The hand-over: invites.blog asks the API for a one-time code (60 seconds, one use, in the server's
 * memory only) for the session it holds, forgets that session, and opens
 * `app.invites.blog/handoff#code=…&next=…`. The code rides in the fragment, which no server log or
 * Referer header sees, and the page there swaps it for the session straight away. The token itself is
 * never in an address.</p>
 *
 * <p>Two ways in: from invites.blog (a click on an app page, an old app address, a buy button), and from
 * app.invites.blog itself, which on the first visit without a session sends the browser to
 * invites.blog/handoff once to look for one there, and comes straight back either way.</p>
 */
@Injectable({ providedIn: 'root' })
export class SessionHandoffService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly split = inject(HostSplit);
  private readonly config = inject(HOST_CONFIG);
  private readonly location = inject(BROWSER_LOCATION);

  /**
   * On invites.blog: opens `next` in the app, taking the sign-in along when this browser has one.
   * `replace` for a page that only exists to pass through (it shouldn't be left in the back history).
   */
  async goToApp(next: string, replace = false): Promise<void> {
    const target = safeNext(next) ?? '/feed';
    const leave = (url: string) => (replace ? this.location.replace(url) : this.location.assign(url));
    if (!this.session.isSessionValid()) {
      leave(this.config.appOrigin + target);
      return;
    }
    try {
      const { code } = await firstValueFrom(this.api.sessionHandoff());
      // The session now lives on the app's host only; a second copy here would outlive a sign-out there.
      this.session.clear();
      leave(`${this.config.appOrigin}/handoff#code=${encodeURIComponent(code)}&next=${encodeURIComponent(target)}`);
    } catch {
      // Couldn't move it (the API is down, the session ended): go anyway; signing in again still works.
      leave(this.config.appOrigin + target);
    }
  }

  /**
   * On app.invites.blog at start: with no session here and never having asked, go and ask invites.blog
   * for one (once). True when the page is leaving, so the app shouldn't start drawing.
   */
  bounceForSession(): boolean {
    if (!this.split.onApp() || this.session.isSessionValid()) return false;
    const here = this.location.current();
    if (NO_BOUNCE.includes(pathOf(here))) return false;
    if (!this.markChecked()) return false;
    this.location.replace(`${this.config.siteOrigin}/handoff?next=${encodeURIComponent(here)}`);
    return true;
  }

  /**
   * On app.invites.blog/handoff: swaps the code in the fragment for the session. Answers where to go
   * next (an in-app path), whether or not the code worked: without it they simply arrive signed out.
   */
  async receive(fragment: string): Promise<string> {
    const params = new URLSearchParams(fragment.replace(/^#/, ''));
    const code = params.get('code');
    const next = safeNext(params.get('next')) ?? '/feed';
    // Asked already, whatever happens: this browser has been to invites.blog and back.
    this.markChecked();
    if (!code) return next;
    try {
      const res = await firstValueFrom(this.api.sessionHandoffRedeem(code));
      this.session.set(res.token, res.account);
    } catch {
      /* expired or used: they sign in again */
    }
    return next;
  }

  /** Records that this browser has asked; false when storage won't keep it (then never ask: no loops). */
  private markChecked(): boolean {
    try {
      if (localStorage.getItem(HANDOFF_CHECKED_KEY) === '1') return false;
      localStorage.setItem(HANDOFF_CHECKED_KEY, '1');
      return localStorage.getItem(HANDOFF_CHECKED_KEY) === '1';
    } catch {
      return false;
    }
  }
}

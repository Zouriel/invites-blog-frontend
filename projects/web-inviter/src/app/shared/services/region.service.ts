import { Injectable, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiService } from '../api/api.service';
import { SessionStore } from './session.store';
import { knownCountry, pickDefaultCountry } from '../utils/country';
import { browserTimeZone, isTimeZone, LEGACY_EVENT_ZONE } from '../utils/event-time';

const GEO_KEY = 'ib_geo_country';

/**
 * Where the person is: the country phone inputs start on, and the time zone new events start in.
 *
 * <ul>
 *   <li>Country: the signed-in account's, else the visitor's from Cloudflare (GET /api/geo, asked once
 *   per browser session and cached in sessionStorage), else none. The person can change it per number.</li>
 *   <li>Time zone: the account's, else the browser's. Signing in to an account with no time zone saves
 *   the browser's once (PUT /api/auth/me/settings), so the server can default new events to it.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class RegionService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly geoCountry = signal<string | null>(this.readCachedGeo());
  private geoAsked = false;
  private zoneSavedFor: string | null = null;

  /** The country a phone input starts on, or null for none. */
  readonly defaultCountry = computed(() => {
    const fromAccount = knownCountry(this.session.account()?.country);
    if (fromAccount) return fromAccount;
    this.askGeo();
    return pickDefaultCountry(null, this.geoCountry());
  });

  /** The zone a new event starts in: the account's, else the browser's, else Malé's. */
  readonly timeZone = computed(() => {
    const saved = this.session.account()?.timeZone;
    if (isTimeZone(saved)) return saved;
    return browserTimeZone() ?? LEGACY_EVENT_ZONE;
  });

  constructor() {
    // Saves the browser's zone on an account that has none, once per account per page load.
    effect(() => {
      const account = this.session.account();
      if (!this.browser || !account || !this.session.isSignedIn() || account.timeZone) return;
      if (this.zoneSavedFor === account.id) return;
      const zone = browserTimeZone();
      if (!zone) return;
      this.zoneSavedFor = account.id;
      untracked(() =>
        this.api.updateAccountSettings({ timeZone: zone }, true).subscribe({
          next: (updated) => {
            if (updated && this.session.account()?.id === updated.id) this.session.setAccount({ ...this.session.account()!, ...updated });
          },
          error: () => {},
        }),
      );
    });
  }

  private askGeo(): void {
    if (this.geoAsked || !this.browser) return;
    this.geoAsked = true;
    try {
      if (sessionStorage.getItem(GEO_KEY) !== null) return;
    } catch {
      /* no storage: ask */
    }
    // Asked outside the computed's reactive context: the answer lands in a signal.
    queueMicrotask(() =>
      this.api.geo().subscribe({
        next: (g) => {
          const c = knownCountry(g?.country) ?? '';
          try {
            sessionStorage.setItem(GEO_KEY, c);
          } catch {
            /* private mode */
          }
          this.geoCountry.set(c || null);
        },
        error: () => {},
      }),
    );
  }

  private readCachedGeo(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const v = sessionStorage.getItem(GEO_KEY);
      return v === null ? null : knownCountry(v);
    } catch {
      return null;
    }
  }
}

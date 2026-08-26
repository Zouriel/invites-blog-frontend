import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { UiThemeService } from '@zouriel/ui/theme';
import { ApiService } from '../api/api.service';
import { SessionStore } from './session.store';

/** The two skins this product ships in. Both are brand palettes, not the library's neutral base. */
const LIGHT = 'lightPurpleGold';
const DARK = 'darkPurple';

/** Only used before anyone signs in — see the class note. */
const GUEST_KEY = 'ib.theme';

/**
 * Light and dark for the whole app.
 *
 * <p><b>The preference belongs to the ACCOUNT, not the browser.</b> Someone who prefers dark prefers
 * it on their phone as well as the laptop they set it on; kept per-browser it silently disagrees
 * with itself and there is no way to notice except being surprised. So signing in adopts the
 * account's choice, and changing it writes back to the server.</p>
 *
 * <p>Signed out there is no account to ask, so the last choice is remembered locally — that is a
 * convenience for the landing pages, not the source of truth, and signing in overrides it.</p>
 *
 * <p>Wraps the library's {@link UiThemeService} rather than replacing it: that service owns
 * `data-theme` on the document root, which every design token keys off. What this adds is the pair.
 * The library's own `toggle()` flips between its NEUTRAL light and dark palettes, which would drop
 * the brand colours on the way past.</p>
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly ui = inject(UiThemeService);
  private readonly session = inject(SessionStore);
  private readonly api = inject(ApiService);
  private readonly doc = inject(DOCUMENT);

  readonly isDark = computed(() => this.ui.theme() === DARK);

  constructor() {
    this.ui.set(this.readGuestPreference() ? DARK : LIGHT);

    // Follow the account: signing in, signing out, or a refreshed account all re-apply its choice.
    // untracked around the write so applying a theme never re-enters this effect.
    effect(() => {
      const preference = this.session.account()?.themePreference ?? null;
      if (!preference) return;
      untracked(() => this.ui.set(preference === 'dark' ? DARK : LIGHT));
    });
  }

  toggle(): void {
    const dark = !this.isDark();
    this.ui.set(dark ? DARK : LIGHT);

    if (!this.session.isSignedIn()) {
      this.writeGuestPreference(dark);
      return;
    }

    // Persist on the account. The theme is already applied, so a failed write leaves the person
    // looking at what they asked for and merely not remembering it — never a flash back.
    this.api.setTheme(dark ? 'dark' : 'light').subscribe({
      next: (account) => this.session.setAccount(account),
      error: () => {},
    });
  }

  /** localStorage throws in a locked-down browser; no stored preference is not an error. */
  private readGuestPreference(): boolean {
    try {
      return this.doc.defaultView?.localStorage.getItem(GUEST_KEY) === 'dark';
    } catch {
      return false;
    }
  }

  private writeGuestPreference(dark: boolean): void {
    try {
      this.doc.defaultView?.localStorage.setItem(GUEST_KEY, dark ? 'dark' : 'light');
    } catch {
      // Not remembering the choice is no reason to fail to apply it.
    }
  }
}

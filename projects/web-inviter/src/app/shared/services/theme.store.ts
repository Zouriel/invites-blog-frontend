import { Injectable, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { UiThemeService } from '@zouriel/ui/theme';

/** The two skins this product ships in. Both are brand palettes, not the library's neutral base. */
const LIGHT = 'lightPurpleGold';
const DARK = 'darkPurple';

const STORAGE_KEY = 'ib.theme';

/**
 * Light/dark for the whole app.
 *
 * <p>Wraps the library's {@link UiThemeService} rather than replacing it: that service owns
 * `data-theme` on the document root, which is what every token in the design system keys off. What
 * this adds is the pair — the library's own `toggle()` flips between its neutral `light` and `dark`
 * base palettes, which would drop the brand colours on the way past. Here "dark" means the dark
 * member of OUR palette, so toggling changes the lighting and not the identity.</p>
 *
 * <p>The choice is remembered per browser. It has to be read back before first paint, which is why
 * index.html carries the light theme as its `data-theme` — a stored dark preference is applied on
 * boot, and a first-time visitor sees the light default with no flash.</p>
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly ui = inject(UiThemeService);
  private readonly doc = inject(DOCUMENT);

  readonly isDark = computed(() => this.ui.theme() === DARK);

  constructor() {
    // localStorage throws in a locked-down browser; a missing preference is not an error.
    let stored: string | null = null;
    try {
      stored = this.doc.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
    } catch {
      stored = null;
    }
    this.ui.set(stored === 'dark' ? DARK : LIGHT);

    effect(() => {
      const dark = this.ui.theme() === DARK;
      try {
        this.doc.defaultView?.localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
      } catch {
        // Not being able to remember the choice is not a reason to fail to apply it.
      }
    });
  }

  toggle(): void {
    this.ui.set(this.isDark() ? LIGHT : DARK);
  }
}

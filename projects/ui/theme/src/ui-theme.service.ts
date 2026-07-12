import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

/**
 * Built-in theme names.
 *
 * - `dark` (default) and `light` are the neutral professional base palettes
 *   (defined in `ui/styles/tokens.css`).
 * - The professional accent palettes — `lightOrange`, `lightPink`, `darkPink`,
 *   `goldBlack`, `goldRed`, `lightTeal`, `darkTeal`, `lightPurple`,
 *   `darkPurple` — are colours-only skins in `ui/styles/theme-palettes.css`,
 *   with optional signature motion in `ui/styles/theme-animations.css`.
 * - `darkOrange` is the cinematic ink/ember skin (grain, FX cursor, web fonts,
 *   glow) and requires `ui/styles/theme-dark-orange.css`. It was formerly
 *   named `dramatic`.
 *
 * Consumers may register their own theme names too — any string is accepted by
 * {@link UiThemeService.set}.
 */
export type UiTheme =
  | 'dark'
  | 'light'
  | 'darkOrange'
  | 'lightOrange'
  | 'lightPink'
  | 'darkPink'
  | 'goldBlack'
  | 'goldRed'
  | 'lightTeal'
  | 'darkTeal'
  | 'lightPurple'
  | 'darkPurple'
  | (string & {});

/**
 * Global theme controller. Drives `data-theme` on the document root so the
 * token overrides in `ui/styles/tokens.css` take effect app-wide. For scoped
 * theming of a subtree, use {@link UiThemeProvider} instead.
 */
@Injectable({ providedIn: 'root' })
export class UiThemeService {
  private readonly doc = inject(DOCUMENT);

  /** Current global theme. Defaults to dark (the library's base palette). */
  readonly theme = signal<UiTheme>('dark');

  constructor() {
    effect(() => {
      const root = this.doc.documentElement;
      if (root) {
        root.dataset['theme'] = this.theme();
      }
    });
  }

  set(theme: UiTheme): void {
    this.theme.set(theme);
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}

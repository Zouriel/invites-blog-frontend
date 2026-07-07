import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

/**
 * Built-in theme names. `dark` (default) and `light` are the professional
 * themes; `dramatic` is the cinematic ink/ember skin (requires
 * `ui/styles/theme-dramatic.css`). Consumers may register their own theme
 * names too — any string is accepted by {@link UiThemeService.set}.
 */
export type UiTheme = 'dark' | 'light' | 'dramatic' | (string & {});

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

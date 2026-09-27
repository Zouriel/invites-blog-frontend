import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

const KEY = 'ib.settingsTrail';

/**
 * Remembers that a page was opened from the gear's Settings menu, so that page can offer a way back.
 *
 * <p>The menu records the section it opened (`/guide`, `/admin`, ...). The trail holds while the reader
 * stays inside that section, so a guide's chapters and the admin screens keep the link, and ends the
 * moment they go anywhere else. Pricing, the guide and the legal pages are also public: reached any
 * other way, by a visitor or from the landing page, there is no trail and no "Settings" link.</p>
 *
 * <p>Kept in sessionStorage so a refresh keeps it. Storage can be missing or throw (private windows,
 * prerendering), and then the link simply doesn't show.</p>
 */
@Injectable({ providedIn: 'root' })
export class SettingsTrail {
  private readonly router = inject(Router);
  private readonly section = signal<string | null>(read());

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
      map((url) => url.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  /** Whether the page being read was reached from the Settings menu. */
  readonly active = computed(() => {
    const section = this.section();
    return !!section && within(this.path(), section);
  });

  constructor() {
    // Leaving the section ends the trail, so coming back to it another way doesn't revive the link.
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      const section = this.section();
      if (section && !within(e.urlAfterRedirects.split(/[?#]/)[0], section)) this.set(null);
    });
  }

  /** Called by the menu just before it opens `section`. */
  enter(section: string): void {
    this.set(section);
  }

  private set(section: string | null): void {
    this.section.set(section);
    try {
      if (section) sessionStorage.setItem(KEY, section);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* No storage: the trail lasts until a refresh. */
    }
  }
}

function within(path: string, section: string): boolean {
  return path === section || path.startsWith(section + '/');
}

function read(): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

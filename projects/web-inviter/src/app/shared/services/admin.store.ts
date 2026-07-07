import { Injectable, computed, signal } from '@angular/core';

/**
 * Stores the admin JWT in localStorage under `ib_admin_jwt`, mirrored into a
 * signal so login state is reactive across the app. The signal is rehydrated
 * from localStorage in the constructor, so a page refresh preserves the session.
 * Separate from per-campaign tokens (TokenStore) — this is the staff session.
 */
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly key = 'ib_admin_jwt';
  private readonly token = signal<string | null>(this.read());

  /** Reactive login state, backed by the persisted token. */
  readonly isLoggedIn = computed(() => !!this.token());

  private read(): string | null {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }

  set(token: string): void {
    this.token.set(token);
    try {
      localStorage.setItem(this.key, token);
    } catch {
      /* storage unavailable (SSR / private mode) — ignore */
    }
  }

  get(): string | null {
    return this.token();
  }

  clear(): void {
    this.token.set(null);
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

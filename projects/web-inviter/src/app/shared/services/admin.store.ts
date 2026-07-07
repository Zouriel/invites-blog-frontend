import { Injectable } from '@angular/core';

/**
 * Stores the admin JWT in localStorage under `ib_admin_jwt`.
 * Separate from per-campaign tokens (TokenStore) — this is the staff session.
 */
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly key = 'ib_admin_jwt';

  set(token: string): void {
    try {
      localStorage.setItem(this.key, token);
    } catch {
      /* storage unavailable (SSR / private mode) — ignore */
    }
  }

  get(): string | null {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }

  isLoggedIn(): boolean {
    return !!this.get();
  }
}

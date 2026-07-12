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

  /** Reactive login state — true only while a non-expired token is stored. */
  readonly isLoggedIn = computed(() => {
    const t = this.token();
    return !!t && !AdminStore.isExpired(t);
  });

  /**
   * Authoritative session check for the route guard. Returns false when the token is missing or
   * its JWT `exp` has passed — and clears the expired token so the app reflects the logout.
   * (The server remains the final authority via 401s handled in the admin interceptor.)
   */
  isSessionValid(): boolean {
    const t = this.token();
    if (!t) return false;
    if (AdminStore.isExpired(t)) {
      this.clear();
      return false;
    }
    return true;
  }

  private static isExpired(token: string): boolean {
    const exp = AdminStore.expirySeconds(token);
    // Unreadable exp → treat as valid; the backend 401 still catches a truly-invalid token.
    return exp !== null && exp * 1000 <= Date.now();
  }

  /** Decode the JWT payload's `exp` (seconds since epoch) without a library. */
  private static expirySeconds(token: string): number | null {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded)) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

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

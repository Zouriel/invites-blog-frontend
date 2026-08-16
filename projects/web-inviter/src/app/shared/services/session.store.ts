import { Injectable, computed, signal } from '@angular/core';
import { Account } from '../utils/types/api.types';

/**
 * The one signed-in session, replacing the separate admin and designer stores.
 *
 * There is a single token because there is a single account: what someone may do is decided by the
 * ROLES on it, not by which page they signed in from. That's what lets one person be an admin, a
 * designer and a customer at the same time instead of holding three logins.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly tokenKey = 'ib_session';
  private readonly accountKey = 'ib_account';

  private readonly token = signal<string | null>(this.read(this.tokenKey));
  readonly account = signal<Account | null>(this.readAccount());

  readonly isSignedIn = computed(() => {
    const t = this.token();
    return !!t && !SessionStore.isExpired(t);
  });

  readonly roles = computed(() => this.account()?.roles ?? []);
  readonly isAdmin = computed(() => this.roles().includes('Admin'));
  /** Admins manage the platform's own templates, so they see the templates screen too. */
  readonly isDesigner = computed(() => this.isAdmin() || this.roles().includes('Designer'));
  readonly displayName = computed(() => this.account()?.displayName ?? '');

  /** Authoritative check for the route guards; clears an expired token so the UI reflects the logout. */
  isSessionValid(): boolean {
    const t = this.token();
    if (!t) return false;
    if (SessionStore.isExpired(t)) {
      this.clear();
      return false;
    }
    return true;
  }

  set(token: string, account: Account): void {
    this.token.set(token);
    this.account.set(account);
    this.write(this.tokenKey, token);
    this.write(this.accountKey, JSON.stringify(account));
  }

  /** Refreshes the cached account after something changes it (linking a number, say). */
  setAccount(account: Account): void {
    this.account.set(account);
    this.write(this.accountKey, JSON.stringify(account));
  }

  get(): string | null {
    return this.token();
  }

  clear(): void {
    this.token.set(null);
    this.account.set(null);
    this.remove(this.tokenKey);
    this.remove(this.accountKey);
    // Retire the pre-unification sessions so an old token can't linger and confuse the nav.
    this.remove('ib_admin_jwt');
    this.remove('ib_designer_jwt');
    this.remove('ib_designer');
  }

  private static isExpired(token: string): boolean {
    const exp = SessionStore.expirySeconds(token);
    // Unreadable exp → treat as valid; the server's 401 still catches a truly-invalid token.
    return exp !== null && exp * 1000 <= Date.now();
  }

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

  private readAccount(): Account | null {
    const raw = this.read(this.accountKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Account;
    } catch {
      return null;
    }
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (SSR / private mode) — ignore */
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

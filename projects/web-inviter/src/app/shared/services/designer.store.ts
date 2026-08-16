import { Injectable, computed, signal } from '@angular/core';
import { Designer } from '../utils/types/api.types';

/**
 * Stores the designer JWT (and the signed-in designer) under `ib_designer_jwt`, mirrored into
 * signals so the header reacts to sign-in/out. Deliberately a separate session from `AdminStore`:
 * a designer is not staff, and signing out of one must not sign you out of the other.
 */
@Injectable({ providedIn: 'root' })
export class DesignerStore {
  private readonly tokenKey = 'ib_designer_jwt';
  private readonly profileKey = 'ib_designer';

  private readonly token = signal<string | null>(this.read(this.tokenKey));
  readonly designer = signal<Designer | null>(this.readProfile());

  /** Reactive sign-in state — true only while a non-expired token is stored. */
  readonly isSignedIn = computed(() => {
    const t = this.token();
    return !!t && !DesignerStore.isExpired(t);
  });

  /** Authoritative check for the route guard; clears an expired token so the app reflects the logout. */
  isSessionValid(): boolean {
    const t = this.token();
    if (!t) return false;
    if (DesignerStore.isExpired(t)) {
      this.clear();
      return false;
    }
    return true;
  }

  set(token: string, designer: Designer): void {
    this.token.set(token);
    this.designer.set(designer);
    this.write(this.tokenKey, token);
    this.write(this.profileKey, JSON.stringify(designer));
  }

  get(): string | null {
    return this.token();
  }

  clear(): void {
    this.token.set(null);
    this.designer.set(null);
    this.remove(this.tokenKey);
    this.remove(this.profileKey);
  }

  private static isExpired(token: string): boolean {
    const exp = DesignerStore.expirySeconds(token);
    // Unreadable exp → treat as valid; a truly-invalid token is still caught by the server's 401.
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

  private readProfile(): Designer | null {
    const raw = this.read(this.profileKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Designer;
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

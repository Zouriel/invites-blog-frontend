import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../utils/constants/storage.constants';

/** Owns the invitee JWT lifecycle in localStorage. */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.jwt);
  }

  setToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.jwt, token);
  }

  clearToken(): void {
    localStorage.removeItem(STORAGE_KEYS.jwt);
  }

  /**
   * True only while a NON-expired token is stored. An expired token is cleared here so guards treat it
   * as logged-out and send the visitor to re-verify (instead of firing a request that 401/403s).
   */
  get isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    if (TokenStore.isExpired(token)) {
      this.clearToken();
      return false;
    }
    return true;
  }

  private static isExpired(token: string): boolean {
    const exp = TokenStore.expirySeconds(token);
    // Unreadable exp → treat as valid; the server's 401/403 still catches a truly-invalid token.
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
}

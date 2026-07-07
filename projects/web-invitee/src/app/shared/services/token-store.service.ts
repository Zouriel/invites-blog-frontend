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

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

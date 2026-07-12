import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../utils/constants/storage.constants';

/** Persists the in-flight OTP challenge between the login and verify pages. */
@Injectable({ providedIn: 'root' })
export class OtpSessionStore {
  save(challengeId: string, destination: string): void {
    sessionStorage.setItem(STORAGE_KEYS.challenge, challengeId);
    sessionStorage.setItem(STORAGE_KEYS.dest, destination);
  }

  get challengeId(): string {
    return sessionStorage.getItem(STORAGE_KEYS.challenge) ?? '';
  }

  get destination(): string {
    return sessionStorage.getItem(STORAGE_KEYS.dest) ?? '';
  }

  clearChallenge(): void {
    sessionStorage.removeItem(STORAGE_KEYS.challenge);
  }
}

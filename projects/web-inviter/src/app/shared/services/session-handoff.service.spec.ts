import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { BROWSER_LOCATION, HOST_CONFIG } from './host-split';
import { HANDOFF_CHECKED_KEY, SessionHandoffService } from './session-handoff.service';
import { SessionStore } from './session.store';

/** jsdom here has no working localStorage; a small one in memory, as the guidance specs do. */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}
Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });

const SITE = 'https://invites.blog';
const APP = 'https://app.invites.blog';

function setup(origin: string, opts: { signedIn?: boolean; current?: string; issue?: () => unknown; redeem?: () => unknown } = {}) {
  const location = { origin: () => origin, current: () => opts.current ?? '/', assign: vi.fn(), replace: vi.fn() };
  const session = { isSessionValid: vi.fn(() => !!opts.signedIn), clear: vi.fn(), set: vi.fn() };
  const api = {
    sessionHandoff: vi.fn(opts.issue ?? (() => of({ code: 'one-time-code', expiresInSeconds: 60 }))),
    sessionHandoffRedeem: vi.fn(opts.redeem ?? (() => of({ token: 'tok', account: { id: 'me' } }))),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: HOST_CONFIG, useValue: { siteOrigin: SITE, appOrigin: APP } },
      { provide: BROWSER_LOCATION, useValue: location },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: ApiService, useValue: api },
      { provide: SessionStore, useValue: session },
    ],
  });
  return { svc: TestBed.inject(SessionHandoffService), location, session, api };
}

describe('SessionHandoffService: keeping people signed in across invites.blog and app.invites.blog', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.resetTestingModule());

  it('from invites.blog, a signed-in browser takes its sign-in along in the fragment and forgets it here', async () => {
    const { svc, location, session, api } = setup(SITE, { signedIn: true });
    await svc.goToApp('/dashboard/42?tab=guests');

    expect(api.sessionHandoff).toHaveBeenCalledOnce();
    expect(session.clear).toHaveBeenCalledOnce();
    const url = location.assign.mock.calls[0][0] as string;
    expect(url).toBe(`${APP}/handoff#code=one-time-code&next=${encodeURIComponent('/dashboard/42?tab=guests')}`);
    // The token itself is never in an address.
    expect(url).not.toContain('tok');
  });

  it('from invites.blog, signed out (or when the API refuses), it simply goes to the same address in the app', async () => {
    const out = setup(SITE);
    await out.svc.goToApp('/billing', true);
    expect(out.location.replace).toHaveBeenCalledWith(`${APP}/billing`);
    expect(out.api.sessionHandoff).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const down = setup(SITE, { signedIn: true, issue: () => throwError(() => new Error('502')) });
    await down.svc.goToApp('/feed');
    expect(down.location.assign).toHaveBeenCalledWith(`${APP}/feed`);
    expect(down.session.clear).not.toHaveBeenCalled();
  });

  it('never sends anyone to an address that is not a path here', async () => {
    const { svc, location } = setup(SITE);
    await svc.goToApp('//evil.example/x');
    expect(location.assign).toHaveBeenCalledWith(`${APP}/feed`);
  });

  it('on app.invites.blog without a sign-in, asks invites.blog once, then never again', () => {
    const first = setup(APP, { current: '/dashboard/7#photos' });
    expect(first.svc.bounceForSession()).toBe(true);
    expect(first.location.replace).toHaveBeenCalledWith(`${SITE}/handoff?next=${encodeURIComponent('/dashboard/7#photos')}`);
    expect(localStorage.getItem(HANDOFF_CHECKED_KEY)).toBe('1');

    TestBed.resetTestingModule();
    const again = setup(APP, { current: '/feed' });
    expect(again.svc.bounceForSession()).toBe(false);
    expect(again.location.replace).not.toHaveBeenCalled();
  });

  it('does not ask when signed in already, on invites.blog, or on the pages a sign-in passes through', () => {
    expect(setup(APP, { signedIn: true }).svc.bounceForSession()).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(SITE).svc.bounceForSession()).toBe(false);
    for (const page of ['/handoff', '/oauth/callback', '/oauth/apple']) {
      TestBed.resetTestingModule();
      expect(setup(APP, { current: `${page}#code=x` }).svc.bounceForSession()).toBe(false);
    }
    expect(localStorage.getItem(HANDOFF_CHECKED_KEY)).toBeNull();
  });

  it('does not ask when the browser will not remember having asked (no loop)', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      const { svc, location } = setup(APP, { current: '/feed' });
      expect(svc.bounceForSession()).toBe(false);
      expect(location.replace).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('on app.invites.blog/handoff, swaps the code for the session and goes on to next', async () => {
    const { svc, session, api } = setup(APP);
    const next = await svc.receive(`#code=abc&next=${encodeURIComponent('/pricing?buy=premium')}`);
    expect(api.sessionHandoffRedeem).toHaveBeenCalledWith('abc');
    expect(session.set).toHaveBeenCalledWith('tok', { id: 'me' });
    expect(next).toBe('/pricing?buy=premium');
    expect(localStorage.getItem(HANDOFF_CHECKED_KEY)).toBe('1');
  });

  it('an expired code, no code, or a foreign next still lands somewhere safe, signed out', async () => {
    const { svc, session } = setup(APP, { redeem: () => throwError(() => new Error('401')) });
    expect(await svc.receive('#code=old&next=%2Fbilling')).toBe('/billing');
    expect(session.set).not.toHaveBeenCalled();
    expect(await svc.receive('')).toBe('/feed');
    expect(await svc.receive('#code=x&next=https%3A%2F%2Fevil.example')).toBe('/feed');
  });
});

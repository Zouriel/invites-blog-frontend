import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_LOCATION, HOST_CONFIG } from '../services/host-split';
import { SessionHandoffService } from '../services/session-handoff.service';
import { hostGuard } from './host.guard';

function run(origin: string, url: string, platform = 'browser') {
  const handoff = { goToApp: vi.fn(async (_next: string) => {}) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: HOST_CONFIG, useValue: { siteOrigin: 'https://invites.blog', appOrigin: 'https://app.invites.blog' } },
      { provide: BROWSER_LOCATION, useValue: { origin: () => origin, current: () => url, assign: vi.fn(), replace: vi.fn() } },
      { provide: PLATFORM_ID, useValue: platform },
      { provide: SessionHandoffService, useValue: handoff },
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    hostGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return { result, handoff, router: TestBed.inject(Router) };
}

describe('hostGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('on invites.blog, an app page opens in the app with the sign-in, and the page stays put', () => {
    const { result, handoff } = run('https://invites.blog', '/dashboard/9?tab=photos');
    expect(result).toBe(false);
    expect(handoff.goToApp).toHaveBeenCalledWith('/dashboard/9?tab=photos');
  });

  it('on invites.blog, public pages and QR pages open right there', () => {
    for (const url of ['/', '/pricing?pass=gold', '/terms', '/q/abc', '/templates/velvet']) {
      TestBed.resetTestingModule();
      const { result, handoff } = run('https://invites.blog', url);
      expect(result, url).toBe(true);
      expect(handoff.goToApp).not.toHaveBeenCalled();
    }
  });

  it('on app.invites.blog there is no landing page: / is the feed, with its query', () => {
    const { result, router } = run('https://app.invites.blog', '/?ref=email');
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/feed?ref=email');
    TestBed.resetTestingModule();
    expect(run('https://app.invites.blog', '/terms').result).toBe(true);
  });

  it('never redirects while prerendering', () => {
    expect(run('', '/feed', 'server').result).toBe(true);
  });
});

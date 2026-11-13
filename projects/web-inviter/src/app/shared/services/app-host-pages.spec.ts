import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAuthCallbackComponent } from '../../pages/oauth/oauth-callback.component';
import { HandoffComponent } from '../../pages/handoff/handoff.component';
import { BROWSER_LOCATION, HOST_CONFIG } from './host-split';
import { OAuthPopupService } from './oauth-popup.service';
import { SeoService } from './seo.service';
import { SessionHandoffService } from './session-handoff.service';

const SITE = 'https://invites.blog';
const APP = 'https://app.invites.blog';

function on(origin: string, current = '/', extra: unknown[] = []) {
  const location = { origin: () => origin, current: () => current, assign: vi.fn(), replace: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: HOST_CONFIG, useValue: { siteOrigin: SITE, appOrigin: APP } },
      { provide: BROWSER_LOCATION, useValue: location },
      { provide: PLATFORM_ID, useValue: 'browser' },
      ...(extra as never[]),
    ],
  });
  return location;
}

describe('pages on app.invites.blog', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Google sign-in from the app returns to the redirect URI registered on invites.blog', () => {
    on(APP);
    expect(TestBed.inject(OAuthPopupService).redirectUri()).toBe(`${SITE}/oauth/callback`);
    TestBed.resetTestingModule();
    on(SITE);
    expect(TestBed.inject(OAuthPopupService).redirectUri()).toBe(`${window.location.origin}/oauth/callback`);
  });

  it('the return page posts the result to our own origins only, the app among them', () => {
    on(SITE);
    const postMessage = vi.fn();
    const before = Object.getOwnPropertyDescriptor(window, 'opener');
    Object.defineProperty(window, 'opener', { value: { postMessage }, configurable: true });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    try {
      TestBed.runInInjectionContext(() => new OAuthCallbackComponent());
      const targets = postMessage.mock.calls.map((c) => c[1]);
      expect(targets).toContain(APP);
      expect(targets).toContain(SITE);
      expect(targets.every((t: string) => [APP, SITE, window.location.origin].includes(t))).toBe(true);
    } finally {
      if (before) Object.defineProperty(window, 'opener', before);
      else delete (window as unknown as Record<string, unknown>)['opener'];
      close.mockRestore();
    }
  });

  it('every page is kept out of search results there, with the canonical address on invites.blog', () => {
    on(APP);
    TestBed.inject(SeoService).set({ title: 'Plans', description: 'd' }, '/pricing');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
    TestBed.resetTestingModule();
    on(SITE);
    TestBed.inject(SeoService).set({ title: 'Plans', description: 'd' }, '/pricing');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://invites.blog/pricing');
  });

  it('/handoff on invites.blog passes the sign-in on to where it was going', async () => {
    const handoff = { goToApp: vi.fn(async (_n: string, _r?: boolean) => {}), receive: vi.fn() };
    history.replaceState(null, '', '/handoff?next=%2Fdashboard%2F3');
    on(SITE, '/handoff?next=%2Fdashboard%2F3', [
      { provide: SessionHandoffService, useValue: handoff },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ next: '/dashboard/3' }) } } },
    ]);
    TestBed.createComponent(HandoffComponent);
    await new Promise((r) => setTimeout(r));
    expect(handoff.goToApp).toHaveBeenCalledWith('/dashboard/3', true);
  });

  it('/handoff on app.invites.blog takes the code over and opens next, with the code gone from the address', async () => {
    const handoff = { goToApp: vi.fn(), receive: vi.fn(async () => '/billing') };
    history.replaceState(null, '', '/handoff#code=c&next=%2Fbilling');
    on(APP, '/handoff#code=c&next=%2Fbilling', [{ provide: SessionHandoffService, useValue: handoff }]);
    const router = TestBed.inject(Router);
    const byUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    TestBed.createComponent(HandoffComponent);
    await new Promise((r) => setTimeout(r));
    expect(handoff.receive).toHaveBeenCalledWith('#code=c&next=%2Fbilling');
    expect(window.location.hash).toBe('');
    expect(byUrl).toHaveBeenCalledWith('/billing', { replaceUrl: true });
  });
});

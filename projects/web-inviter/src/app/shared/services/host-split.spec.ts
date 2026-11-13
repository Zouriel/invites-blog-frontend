import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { BROWSER_LOCATION, HOST_CONFIG, HostSplit, isSitePath, safeNext } from './host-split';

const SITE = 'https://invites.blog';
const APP = 'https://app.invites.blog';

export function hostProviders(origin: string, split = true, platform: 'browser' | 'server' = 'browser') {
  return [
    { provide: HOST_CONFIG, useValue: split ? { siteOrigin: SITE, appOrigin: APP } : { siteOrigin: '', appOrigin: '' } },
    {
      provide: BROWSER_LOCATION,
      useValue: { origin: () => origin, current: () => '/', assign: () => {}, replace: () => {} },
    },
    { provide: PLATFORM_ID, useValue: platform },
  ];
}

/** Every page's address, with a stand-in for each parameter. */
function addresses(list: Route[], prefix = ''): string[] {
  return list.flatMap((r) => {
    if (r.path === undefined || r.path === '**') return [];
    const path = [prefix, r.path].filter(Boolean).join('/').replace(/:[^/]+/g, 'x');
    return [`/${path}`, ...addresses(r.children ?? [], path)];
  });
}

describe('HostSplit: which host shows which page', () => {
  afterEach(() => TestBed.resetTestingModule());

  // The public site keeps what search engines, visitors and printed QR cards reach; the app takes the rest.
  // A new page has to be put on one side or the other here, and in Caddy's @app_paths for the app side.
  const SITE_PAGES = [
    '/', '/pricing', '/guide', '/bring-your-own', '/inquire', '/privacy', '/child-safety', '/delete-account',
    '/terms', '/refunds', '/security', '/contact', '/example-event', '/handoff', '/oauth/callback', '/oauth/apple',
    '/templates/x', '/invitations/x', '/q/x',
  ];

  it('puts every page on exactly the side it was decided for', () => {
    const all = [...new Set(addresses(routes))];
    const onSite = all.filter((a) => isSitePath(a));
    const guides = onSite.filter((a) => a.startsWith('/guide/'));
    expect(onSite.filter((a) => !a.startsWith('/guide/')).sort()).toEqual([...SITE_PAGES].sort());
    expect(guides.length).toBeGreaterThan(3);
    // Spot checks of the app side, including the gallery's old address (it is the feed's tab now).
    for (const a of ['/feed', '/me', '/me/settings', '/login', '/billing', '/dashboard/x', '/create/x/guests', '/design/x', '/admin', '/templates', '/events/new', '/invitation/x', '/buckets/x', '/favourites', '/inbox', '/join', '/template-designer', '/my-templates']) {
      expect(isSitePath(a), a).toBe(false);
    }
  });

  it('reads the path only: a query or a trailing slash changes nothing', () => {
    expect(isSitePath('/pricing?buy=premium')).toBe(true);
    expect(isSitePath('/terms/')).toBe(true);
    expect(isSitePath('/q/abc#x')).toBe(true);
    expect(isSitePath('/feed?tab=templates')).toBe(false);
    expect(isSitePath('/templates/')).toBe(false);
  });

  it('only lets a next address be a path on this site', () => {
    expect(safeNext('/dashboard/1?tab=guests#top')).toBe('/dashboard/1?tab=guests#top');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', '/\tx', 'feed', '', null, undefined]) {
      expect(safeNext(bad as string | null)).toBeNull();
    }
  });

  it('knows which host it is on, and builds addresses on the other', () => {
    TestBed.configureTestingModule({ providers: hostProviders(SITE) });
    const site = TestBed.inject(HostSplit);
    expect([site.enabled, site.onSite(), site.onApp()]).toEqual([true, true, false]);
    expect(site.appUrl('/feed')).toBe(`${APP}/feed`);
    expect(site.siteApiOrigin()).toBe('');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: hostProviders(APP) });
    const app = TestBed.inject(HostSplit);
    expect([app.onSite(), app.onApp()]).toEqual([false, true]);
    expect(app.siteUrl('/oauth/callback')).toBe(`${SITE}/oauth/callback`);
    // Apple's start and redeem go to the host Apple returns to.
    expect(app.siteApiOrigin()).toBe(SITE);
    expect(app.trustedOrigins().sort()).toEqual([APP, SITE].sort());
  });

  it('with one host (staging, local) nothing is split, and prerendering counts as the public site', () => {
    TestBed.configureTestingModule({ providers: hostProviders('https://staging.invites.blog', false) });
    const one = TestBed.inject(HostSplit);
    expect([one.enabled, one.onSite(), one.onApp()]).toEqual([false, false, false]);
    expect(one.appUrl('/feed')).toBe('/feed');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: hostProviders('', true, 'server') });
    const prerender = TestBed.inject(HostSplit);
    expect([prerender.onSite(), prerender.onApp()]).toEqual([true, false]);
  });
});

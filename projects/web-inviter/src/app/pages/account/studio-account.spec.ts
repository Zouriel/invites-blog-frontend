import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Route } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { routes } from '../../app.routes';
import { HeaderComponent } from '../../layout/header/header.component';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { ThemeStore } from '../../shared/services/theme.store';
import { planLabel } from '../../shared/utils/plans';
import { Account } from '../../shared/utils/types/api.types';
import { AccountComponent } from './account.component';

/**
 * Studio is an account type (owner, 2026-11-12): there is no venue page, no venue code and no staff.
 * The plan kind stays "Venue" on the wire; people only ever see "Studio".
 */

globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

const STUDIO = {
  id: 'u1', email: 'events@example.com', displayName: 'Coral Events', roles: ['Customer'],
  subscriptionTier: 'Venue', subscriptionEndsAt: null, atVenue: true,
} as unknown as Account;

/** Every path in the route table, children included, as written. */
function paths(rs: Route[]): string[] {
  return rs.flatMap((r) => [r.path ?? '', ...paths(r.children ?? [])]);
}

/** Every place a rendered page links or navigates to. */
function links(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('a[href], [ng-reflect-router-link], [routerlink]')).map(
    (a) => a.getAttribute('href') ?? a.getAttribute('routerlink') ?? a.getAttribute('ng-reflect-router-link') ?? '',
  );
}

function mountAccount(section: 'menu' | 'profile') {
  const api = new Proxy({} as Record<string, unknown>, { get: (t, k: string) => t[k] ?? (() => of(null)) });
  TestBed.configureTestingModule({
    imports: [AccountComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn(), info: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { section }, queryParamMap: convertToParamMap({}), paramMap: convertToParamMap({}) } } },
    ],
  });
  TestBed.inject(SessionStore).setAccount(STUDIO);
  const fixture = TestBed.createComponent(AccountComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('Studio is an account type: no venue page anywhere', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('the route table has no venue page (the wizard place step create/:id/venue is something else)', () => {
    const all = paths(routes);
    expect(all.length).toBeGreaterThan(20);
    expect(all.filter((p) => p.split('/')[0] === 'venue')).toEqual([]);
    expect(all.filter((p) => /venue/.test(p))).toEqual(['create/:campaignId/venue']);
  });

  it('the plan is called Studio on screen, though its kind stays Venue', () => {
    expect(planLabel('Venue')).toBe('Studio');
    expect(planLabel('Premium')).toBe('Premium');
  });

  it('the account menu of a Studio account offers no venue page, even when an old server sends atVenue', async () => {
    const { fixture, el } = mountAccount('menu');
    await fixture.whenStable();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('ui-list-item')).map((i) => i.textContent?.trim() ?? '');
    expect(items.length).toBeGreaterThan(2);
    expect(items.some((t) => /venue/i.test(t))).toBe(false);
    expect(links(el).filter((l) => /\/venue/.test(l))).toEqual([]);
  });

  it("the profile's plan card says Studio and links to Billing, never to a venue page", async () => {
    const { fixture, el } = mountAccount('profile');
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (el.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Your plan');
    expect(text).toContain('Studio');
    expect(text).not.toMatch(/Venue|Open your venue/);
    expect(links(el).filter((l) => /\/venue/.test(l))).toEqual([]);
    expect(links(el)).toContain('/billing');
  });

  it('the main navigation never links to /venue, signed in on Studio', () => {
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: {
            isSignedIn: signal(true), isAdmin: signal(false), isDesigner: signal(true), account: signal(STUDIO),
            roles: signal(['Customer']), displayName: signal('Coral Events'), subscriptionTier: signal('Venue'),
            isPremium: signal(false), isStudio: signal(true), clear: () => {},
          },
        },
        { provide: ThemeStore, useValue: { isDark: signal(false), toggle: () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(links(el).length).toBeGreaterThan(0);
    expect(links(el).filter((l) => /\/venue/.test(l))).toEqual([]);
    expect(el.textContent ?? '').not.toMatch(/venue/i);
  });
});

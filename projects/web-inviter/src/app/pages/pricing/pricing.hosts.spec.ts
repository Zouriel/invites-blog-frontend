import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';
import { SessionStore } from '../../shared/services/session.store';
import { SessionHandoffService } from '../../shared/services/session-handoff.service';
import { BROWSER_LOCATION, HOST_CONFIG } from '../../shared/services/host-split';
import { PLAN_CATALOG } from '../../shared/utils/plans';
import { PricingComponent } from './pricing.component';

/** Plans on each host: invites.blog sells by sending people to the app; the app opens the purchase asked for. */
async function mount(origin: string, query: Record<string, string> = {}, signedIn = true) {
  const checkout = { start: vi.fn(() => EMPTY) };
  const handoff = { goToApp: vi.fn(async (_next: string) => {}) };
  TestBed.configureTestingModule({
    imports: [PricingComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: HOST_CONFIG, useValue: { siteOrigin: 'https://invites.blog', appOrigin: 'https://app.invites.blog' } },
      { provide: BROWSER_LOCATION, useValue: { origin: () => origin, current: () => '/pricing', assign: vi.fn(), replace: vi.fn() } },
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: SessionHandoffService, useValue: handoff },
      { provide: ApiService, useValue: { plans: vi.fn(() => of(PLAN_CATALOG)), billing: vi.fn(() => of({ events: [] })) } },
      { provide: CheckoutFlow, useValue: checkout },
      { provide: UiToastService, useValue: { info: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(signedIn), account: signal(signedIn ? { id: 'me', subscriptionTier: 'None' } : null) } },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PricingComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return { cmp: fixture.componentInstance as unknown as Record<string, any>, checkout, handoff, navigate };
}

describe('Plans on invites.blog and app.invites.blog', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('on invites.blog every buy button opens the same purchase in the web app', async () => {
    const { cmp, handoff, checkout } = await mount('https://invites.blog');
    cmp['subscribe']('premium-monthly');
    cmp['subscribe']('premium-ai-monthly');
    cmp['subscribe']('venue-monthly');
    cmp['choosePass']('gold-pass');
    cmp['choosePass']('platinum-pass', 'ev-1');
    expect(handoff.goToApp.mock.calls.map((c) => c[0])).toEqual([
      '/pricing?buy=premium',
      '/pricing?buy=premium-ai',
      '/pricing?buy=studio',
      '/pricing?pass=gold',
      '/pricing?pass=platinum&event=ev-1',
    ]);
    expect(checkout.start).not.toHaveBeenCalled();
  });

  it('on app.invites.blog, ?buy= goes straight to the review step for that subscription', async () => {
    const { checkout, cmp } = await mount('https://app.invites.blog', { buy: 'premium-ai' });
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'premium-ai-monthly' }));
    expect(cmp['withAi']()).toBe(true);
  });

  it('on app.invites.blog signed out, ?buy= and ?pass= go to sign in and come back to the same purchase', async () => {
    const premium = await mount('https://app.invites.blog', { buy: 'premium' }, false);
    expect(premium.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { next: '/pricing?buy=premium' } });
    expect(premium.checkout.start).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const gold = await mount('https://app.invites.blog', { pass: 'gold' }, false);
    expect(gold.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { next: '/pricing?pass=gold' } });
  });

  it('an unknown ?buy= does nothing', async () => {
    const { checkout, navigate } = await mount('https://app.invites.blog', { buy: 'everything' });
    expect(checkout.start).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

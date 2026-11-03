import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';
import { BillingEvent, BillingOverview } from '../../shared/utils/types/api.types';
import { BillingComponent } from './billing.component';

const offer = { goldPass: 199, platinumPass: 499, fullGoldPass: 199, fullPlatinumPass: 499, goldExtension: 99, platinumExtension: 349, venuePercent: 0, venueName: null };
const event = (over: Partial<BillingEvent>): BillingEvent => ({
  campaignId: 'e1', title: 'Aisha & Ali', eventStartAt: '2026-12-20T12:00:00Z', kind: 'invitation', plan: 'Free',
  passUntil: null, keepPhotosUntil: null, coveredUntil: null, phase: 'Active',
  sending: { included: 0, extra: 0, used: 0, total: 0, left: 0 }, atVenue: false, pass: 'None', passActive: false,
  offer: offer as BillingEvent['offer'], isDraft: false, ...over,
});
const overview = (events: BillingEvent[], account: Partial<BillingOverview['account']> = {}): BillingOverview => ({
  paymentsEnabled: true, currency: 'MVR', mvrPerUsd: 15.42,
  prices: { goldPass: 199, platinumPass: 499, keepPhotos: 150, sendingPerBlock: 50, sendingBlockSize: 100, premiumMonthly: 200, venueDiscountPercent: 50, goldExtension: 99, platinumExtension: 349, venueMonthly: 2300 },
  account: { tier: 'None', endsAt: null, active: false, autoRenew: null, ...account },
  events,
  payments: [],
} as unknown as BillingOverview);

async function mount(o: BillingOverview) {
  TestBed.configureTestingModule({
    imports: [BillingComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { billing: vi.fn(() => of(o)), billingStopAutoRenew: vi.fn() } },
      { provide: CheckoutFlow, useValue: { start: vi.fn(() => EMPTY), confirmReturn: vi.fn(() => EMPTY) } },
      { provide: UiToastService, useValue: { success: vi.fn(), info: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(BillingComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
  return { el, text: () => el.textContent ?? '', buttons };
}

describe('Billing (docs/PLANS-UX.md: states, sells nothing but one link)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('a free account with free events: kept forever, no buy buttons, one "See plans" link', async () => {
    const { el, text, buttons } = await mount(overview([event({}), event({ campaignId: 'e2', title: 'Birthday' })]));
    expect(text()).toContain('kept forever');
    expect(buttons().filter((b) => /pass|Keep|emails|Premium/.test(b))).toEqual([]);
    expect(Array.from(el.querySelectorAll('a')).filter((a) => a.textContent?.trim() === 'See plans')).toHaveLength(1);
    expect(text()).not.toContain('Keep everything');
  });

  it('only what means something: extend and keep once a pass has ended, more emails when nearly used', async () => {
    const ended = event({ pass: 'Gold', passActive: false, passUntil: null, plan: 'Free', sending: { included: 100, extra: 0, used: 95, total: 100, left: 5 } });
    const { buttons, text } = await mount(overview([ended]));
    expect(buttons()).toEqual(expect.arrayContaining(['Extend a year · MVR 99', 'Keep everything a year · MVR 150', '100 more emails · MVR 50']));
    expect(text()).toContain('Its Gold pass has ended');
  });

  it('a pass in force far from its end offers nothing; a draft offers nothing', async () => {
    const far = new Date(Date.now() + 200 * 864e5).toISOString();
    const { buttons, text } = await mount(overview([
      event({ pass: 'Platinum', passActive: true, passUntil: far, plan: 'PlatinumPass' }),
      event({ campaignId: 'e2', isDraft: true }),
    ]));
    expect(buttons()).toEqual([]);
    expect(text()).toContain('Platinum pass until');
    expect(text()).toContain('Not finished');
  });

  it('warns about a coming cut with its date and size', async () => {
    const { text } = await mount(overview([event({ pass: 'Gold', trimAt: '2027-01-10T00:00:00Z', trimBytes: 1.5 * 1024 ** 3 })]));
    expect(text()).toContain('Back to Free on 10 Jan 2027');
    expect(text()).toContain('1.5 GB');
  });

  it('a store subscription says where it is managed and offers no card controls', async () => {
    const { text, buttons } = await mount(overview([], { tier: 'Premium', active: true, endsAt: '2026-12-20T00:00:00Z', store: 'google_play', storeAutoRenew: true }));
    expect(text()).toContain('Renews through Google Play on 20 Dec 2026');
    expect(text()).toContain('manage or cancel it in your Google Play subscriptions');
    expect(buttons()).toEqual([]);
  });
});

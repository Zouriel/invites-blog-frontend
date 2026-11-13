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
const overview = (events: BillingEvent[], account: Partial<BillingOverview['account']> = {}, forYou?: BillingEvent[]): BillingOverview => ({
  paymentsEnabled: true, currency: 'MVR', mvrPerUsd: 15.42,
  prices: { goldPass: 199, platinumPass: 499, keepPhotos: 150, sendingPerBlock: 50, sendingBlockSize: 100, premiumMonthly: 77, designerAiMonthly: 77, venueDiscountPercent: 50, goldExtension: 99, platinumExtension: 349, venueMonthly: 2300 },
  account: { tier: 'None', endsAt: null, active: false, autoRenew: null, ...account },
  events,
  payments: [],
  ...(forYou ? { forYou } : {}),
} as unknown as BillingOverview);

async function mount(o: BillingOverview) {
  TestBed.configureTestingModule({
    imports: [BillingComponent],
    providers: [
      provideRouter([]),
      {
        provide: ApiService,
        useValue: {
          billing: vi.fn(() => of(o)),
          billingStopAutoRenew: vi.fn(),
          billingDesignerAi: vi.fn((on: boolean) =>
            of({ ...o.account, addOns: [{ key: 'designer-ai', active: true, renews: on, endsAt: '2026-12-20T00:00:00Z' }] }),
          ),
        },
      },
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
  return {
    el, fixture, text: () => el.textContent ?? '', buttons,
    api: TestBed.inject(ApiService) as unknown as { billingDesignerAi: ReturnType<typeof vi.fn> },
    checkout: TestBed.inject(CheckoutFlow) as unknown as { start: ReturnType<typeof vi.fn> },
  };
}

/** The text of one section's rows: "Your events" (mine) or "Events you’re in" (theirs). */
const rows = (el: HTMLElement, list: 'mine' | 'theirs') =>
  Array.from(el.querySelectorAll('li.event'))
    .filter((li) => !!li.closest('.for-you') === (list === 'theirs'))
    .map((li) => (li.textContent ?? '').replace(/\s+/g, ' '));

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

  it('a Studio account (plan kind Venue): called Studio everywhere, its benefits, never the word Venue', async () => {
    const { el, text } = await mount(overview(
      [event({ title: 'Beach wedding', plan: 'Venue', atVenue: true })],
      { tier: 'Venue', active: true, endsAt: '2026-12-20T00:00:00Z', autoRenew: 'venue-monthly' },
      [event({ campaignId: 'w9', title: 'Gala', role: 'celebrant', plan: 'Venue', atVenue: true })],
    ));
    // The same card as on Plans: Studio's name and its perks.
    expect(el.querySelector('ui-plan-card .name')?.textContent?.trim()).toBe('Studio');
    expect(text()).toContain('10 GB on every event you organise');
    expect(text()).toContain('Your picture and name on its albums, QR cards and posts');
    expect(rows(el, 'mine')[0]).toContain('On your Studio plan');
    expect(rows(el, 'theirs')[0]).toContain('On the organiser’s Studio plan');
    expect(text()).not.toMatch(/Venue|venue/);
  });

  it('a Photographer account: called Photographer, its events on its Photographer plan, renews photographer-monthly', async () => {
    const { el, text } = await mount(overview(
      [event({ title: 'Shoot', plan: 'Photographer', atVenue: true })],
      { tier: 'Photographer', active: true, endsAt: '2026-12-20T00:00:00Z', autoRenew: 'photographer-monthly' },
    ));
    expect(el.querySelector('ui-plan-card .name')?.textContent?.trim()).toBe('Photographer');
    expect(text()).toContain('portfolio');
    expect(text()).not.toContain('AI designer included');
    expect(rows(el, 'mine')[0]).toContain('On your Photographer plan');
  });

  it("lists the events you're in under their own heading, with the same rows and no emails to buy", async () => {
    const nearlyUsed = { included: 100, extra: 0, used: 95, total: 100, left: 5 };
    const { el, text, buttons } = await mount(overview(
      [event({ title: 'My party' })],
      {},
      [
        event({ campaignId: 'w1', title: 'Our wedding', role: 'celebrant', pass: 'Gold', passActive: false, sending: nearlyUsed }),
        event({ campaignId: 'w2', title: 'Resort wedding', role: 'manager', plan: 'Venue', atVenue: true }),
      ],
    ));
    const headings = Array.from(el.querySelectorAll('ui-text')).map((t) => t.textContent?.trim());
    expect(headings.indexOf('Events you’re in')).toBe(headings.indexOf('Your events') + 1);
    expect(rows(el, 'mine')).toHaveLength(1);
    const theirs = rows(el, 'theirs');
    expect(theirs).toHaveLength(2);
    expect(theirs[0]).toContain('Our wedding');
    expect(theirs[0]).toContain('It’s for you');
    expect(theirs[1]).toContain('You help run it');
    expect(theirs[1]).toContain('Studio');
    expect(theirs[1]).toContain('On the organiser’s Studio plan');
    // The same actions an organiser's row has, but emails stay the organiser's.
    expect(buttons()).toEqual(expect.arrayContaining(['Extend a year · MVR 99', 'Keep everything a year · MVR 150']));
    expect(buttons().some((b) => /emails/.test(b))).toBe(false);
    expect(text()).not.toMatch(/staff|venue/i);
  });

  it("an event whose organiser's Studio plan ended offers only a Platinum pass, with the warning", async () => {
    const { el, buttons, checkout } = await mount(overview([], {}, [
      event({ campaignId: 'w1', title: 'Our wedding', role: 'celebrant', atVenue: true, venueEnded: true, phase: 'UploadsClosed', trimAt: '2027-01-10T00:00:00Z', trimBytes: 2 * 1024 ** 3 }),
    ]));
    const row = rows(el, 'theirs')[0];
    expect(row).toContain('The organiser’s plan has ended: back to Free on 10 Jan 2027');
    expect(row).not.toMatch(/venue/i);
    expect(row).toContain('2 GB');
    expect(row).toContain('A Platinum pass keeps everything');
    expect(buttons()).toEqual(['Platinum pass · MVR 499']);
    expect(el.querySelector('.for-you a[href*="pricing"]')).toBeNull();
    (Array.from(el.querySelectorAll('.for-you button'))[0] as HTMLButtonElement).click();
    expect(checkout.start).toHaveBeenCalledWith({ item: 'platinum-pass', campaignId: 'w1', quantity: undefined });
  });

  it('no section when you are in nothing, or the server is older and says nothing', async () => {
    for (const forYou of [[], undefined]) {
      const { text } = await mount(overview([event({})], {}, forYou));
      expect(text()).not.toContain('Events you’re in');
      TestBed.resetTestingModule();
    }
  });

  describe('the AI designer on Premium (docs/PRICING-2026-11.md §3)', () => {
    const premium = (addOn: Record<string, unknown> | null, extra: Partial<BillingOverview['account']> = {}) =>
      overview([], {
        tier: 'Premium', active: true, endsAt: '2026-12-20T00:00:00Z', autoRenew: 'premium-monthly',
        addOns: addOn ? [{ key: 'designer-ai', ...addOn } as never] : [], ...extra,
      });

    it('Premium without it: says Off and offers "Add it", which goes to the review step as designer-ai-add', async () => {
      const { text, buttons, checkout, el } = await mount(premium({ active: false, renews: false, endsAt: null }));
      expect(text()).toContain('AI designer');
      expect(text()).toContain('Off. Add it for MVR 77 a month.');
      expect(el.querySelector('ui-plan-card .name')?.textContent?.trim()).toBe('Premium');
      const add = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Add it')!;
      add.click();
      expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'designer-ai-add' }));
      expect(buttons()).not.toContain('Turn it off');
    });

    it('on and renewing: says what renews (MVR 154) and "Turn it off" stops only its renewal', async () => {
      const { text, el, api } = await mount(premium({ active: true, renews: true, endsAt: '2026-12-20T00:00:00Z' }));
      expect(text()).toContain('Renews with Premium at MVR 154 a month from 20 Dec 2026');
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Turn it off')!.click();
      expect(api.billingDesignerAi).toHaveBeenCalledWith(false);
    });

    it("on until the month ends (turned off, or an existing subscriber's carry-over): offers to keep it", async () => {
      const { text, el, api } = await mount(premium({ active: true, renews: false, endsAt: '2026-12-20T00:00:00Z' }));
      expect(text()).toContain("On until 20 Dec 2026. It won't renew unless you keep it (MVR 154 a month with Premium)");
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Keep it')!.click();
      expect(api.billingDesignerAi).toHaveBeenCalledWith(true);
    });

    it('Premium from a store: no card controls for the add-on, it is changed in the app', async () => {
      const { text, buttons } = await mount(premium({ active: false, renews: false, endsAt: null }, { store: 'app_store', storeAutoRenew: true }));
      expect(text()).toContain('Add it in the app you subscribed in');
      expect(buttons()).toEqual([]);
    });
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';
import { SessionStore } from '../../shared/services/session.store';
import { PLAN_CATALOG } from '../../shared/utils/plans';
import { BillingEvent, PlanCatalog } from '../../shared/utils/types/api.types';
import { BUY_PARAM, PricingComponent } from './pricing.component';
import { pricingFaq } from './pricing-faq';

const ev = (id: string, over: Partial<BillingEvent> = {}): BillingEvent => ({
  campaignId: id, title: `Event ${id}`, eventStartAt: '2026-12-20T12:00:00Z', kind: 'invitation', plan: 'Free',
  passUntil: null, keepPhotosUntil: null, coveredUntil: null, phase: 'Active',
  sending: { included: 0, extra: 0, used: 0, total: 0, left: 0 }, atVenue: false, pass: 'None', passActive: false,
  offer: {} as BillingEvent['offer'], isDraft: false, ...over,
});

async function mount(events: BillingEvent[], signedIn = true, others: BillingEvent[] = [], account?: Record<string, unknown>, forYou?: BillingEvent[], served: PlanCatalog = PLAN_CATALOG) {
  const checkout = { start: vi.fn(() => EMPTY) };
  // An event this account didn't make (it is one of the people it is for): asked for on its own.
  const billingEvent = vi.fn((id: string) => {
    const e = others.find((x) => x.campaignId === id);
    return e ? of(e) : throwError(() => Object.assign(new Error('Forbidden'), { status: 403 }));
  });
  TestBed.configureTestingModule({
    imports: [PricingComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { plans: vi.fn(() => of(served)), billing: vi.fn(() => of({ events, forYou })), billingEvent } },
      { provide: CheckoutFlow, useValue: checkout },
      { provide: UiToastService, useValue: { info: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(signedIn), account: signal(signedIn ? { id: 'me', subscriptionTier: 'None', ...account } : null) } },
    ],
  });
  const fixture = TestBed.createComponent(PricingComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
  };
  const button = (text: RegExp) => Array.from(el.querySelectorAll('ui-button')).find((b) => text.test(b.textContent ?? '')) as HTMLElement | undefined;
  return { fixture, el, settle, button, checkout, cmp: fixture.componentInstance as unknown as Record<string, any> };
}

describe('Plans (docs/PLANS-UX.md)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sells each plan right on its card, in its tier colour, with one highlight', async () => {
    const { el, button } = await mount([]);
    const tier = (b: HTMLElement | undefined) => b?.querySelector('[data-tier]')?.getAttribute('data-tier');
    expect(tier(button(/Get Gold · MVR 199/))).toBe('gold');
    expect(tier(button(/Get Platinum · MVR 499/))).toBe('platinum');
    expect(tier(button(/Subscribe · MVR 77 a month/))).toBe('premium');
    const highlights = Array.from(el.querySelectorAll('ui-plan-card')).filter((c) => (c.textContent ?? '').includes('Best for weddings'));
    expect(highlights).toHaveLength(1);
    expect(el.textContent).not.toContain('Start your event');
  });

  it('the pass picker leaves out save the dates and events already on that pass or more', async () => {
    const { cmp, settle } = await mount([
      ev('a'),
      ev('b', { kind: 'saveTheDate' }),
      ev('c', { pass: 'Gold', passActive: true }),
      ev('d', { pass: 'Platinum', passActive: true }),
    ]);
    cmp['choosePass']('gold-pass');
    await settle();
    expect(cmp['eligible']().map((e: BillingEvent) => e.campaignId)).toEqual(['a']);
    expect(cmp['chosen']()).toBe('a');
    cmp['choosePass']('platinum-pass');
    await settle();
    expect(cmp['eligible']().map((e: BillingEvent) => e.campaignId)).toEqual(['a', 'c']);
  });

  it('gives the subscription cards in one row the same small print, so their buttons line up', async () => {
    const { el } = await mount([]);
    const row = Array.from(el.querySelectorAll('ui-plan-grid')).find((g) => (g.textContent ?? '').includes('Subscribe ·'))!;
    const prints = Array.from(row.querySelectorAll('ui-plan-card')).map((c) => (c.querySelector('.fineprint')?.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(prints.length).toBeGreaterThanOrEqual(3);
    expect(new Set(prints).size).toBe(1);
    expect(prints[0]).toContain('Renews every month');
  });

  it('sells Studio (plan kind Venue) on a full plan card beside Premium: MVR 775 a month, about $50, its benefits, no staff or discount', async () => {
    const { el, button } = await mount([]);
    const cards = Array.from(el.querySelectorAll('ui-plan-card'));
    const venueCard = cards.find((c) => (c.textContent ?? '').includes('Get Studio'))!;
    expect(venueCard).toBeTruthy();
    // In the same grid as Premium.
    expect(venueCard.closest('ui-plan-grid')).toBe(cards.find((c) => (c.textContent ?? '').includes('Subscribe ·'))!.closest('ui-plan-grid'));
    const venue = (venueCard.textContent ?? '').replace(/\s+/g, ' ');
    expect(venue).toContain('MVR 775');
    expect(venue).toContain('a month');
    expect(venue).toContain('about $50');
    expect(venue).toContain('Studio');
    for (const benefit of ['10 GB on every event you organise', 'No “Made with invites.blog” mark', 'Face grouping', 'Photos kept while you’re on Studio',
      'Your picture and name on its albums, QR cards and posts']) expect(venue).toContain(benefit);
    expect(venue).toContain('your events go back to Free');
    expect(venue).toContain('Platinum pass');
    expect(venue).not.toMatch(/%|half|discount|staff|venue|code/i);
    expect(button(/Get Studio · MVR 775 a month/)?.querySelector('[data-tier]')?.getAttribute('data-tier')).toBe('premium');
    expect(el.textContent).not.toContain('Run a resort or hall?');
    const faq = pricingFaq().find((f) => /Studio/.test(f.q))!.a;
    expect(faq).toContain('MVR 775');
    expect(faq).toContain('profile picture and name');
    expect(faq).not.toMatch(/venue|staff|code/i);
    expect(faq).toContain('Platinum pass');
    expect(faq).not.toMatch(/%|half price|discount/i);
  });

  it('sells Photographer between Premium and Studio: MVR 540 a month, its portfolio, no AI designer tick, buys photographer-monthly', async () => {
    const { el, button, checkout } = await mount([]);
    const cards = Array.from(el.querySelectorAll('ui-plan-card')).map((c) => (c.textContent ?? '').replace(/\s+/g, ' '));
    const premium = cards.findIndex((t) => t.includes('Subscribe ·'));
    const photographer = cards.findIndex((t) => t.includes('Get Photographer'));
    const studio = cards.findIndex((t) => t.includes('Get Studio'));
    expect(photographer).toBe(premium + 1);
    expect(studio).toBe(photographer + 1);
    const card = cards[photographer];
    expect(card).toContain('MVR 540');
    expect(card).toContain('portfolio');
    // Owner copy rule (2026-11-13): Photographer is described by what it includes, never as Studio minus AI.
    expect(card).not.toMatch(/without the AI|but the AI|except the AI/i);
    expect(card).not.toContain('Add the AI designer');
    button(/Get Photographer · MVR 540 a month/)!.querySelector('button')!.click();
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'photographer-monthly' }));
    const faq = pricingFaq().find((f) => /Photographer\?/.test(f.q))!.a;
    expect(faq).toContain('MVR 540');
    expect(faq).toContain('portfolio');
    expect(BUY_PARAM['photographer']).toBe('photographer-monthly');
  });

  it('on Photographer: its card is marked as yours and leads to Billing', async () => {
    const { button } = await mount([], true, [], { subscriptionTier: 'Photographer', subscriptionEndsAt: null });
    expect(button(/Get Photographer/)).toBeUndefined();
    expect(button(/Get Studio/)).toBeTruthy();
    expect(button(/Manage in Billing/)).toBeTruthy();
  });

  it('on Studio (kind Venue): the card is marked as yours and leads to Billing instead of selling', async () => {
    const { el, button } = await mount([], true, [], { subscriptionTier: 'Venue', subscriptionEndsAt: null });
    expect(button(/Get Studio/)).toBeUndefined();
    expect(button(/Manage in Billing/)).toBeTruthy();
    expect(el.querySelector('.free__name')?.textContent).toBe('Studio');
  });

  it('never shows the word Venue: the plan is called Studio to people (signed out and on Studio)', async () => {
    for (const account of [undefined, { subscriptionTier: 'Venue', subscriptionEndsAt: null }]) {
      const { el } = await mount([], true, [], account);
      expect(el.textContent).toContain('Studio');
      expect(el.textContent).not.toMatch(/Venue/);
      TestBed.resetTestingModule();
    }
    for (const f of pricingFaq()) expect(`${f.q} ${f.a}`).not.toMatch(/Venue/);
  });

  it('the pass picker also offers the events you are in (forYou), once each', async () => {
    const { cmp, settle } = await mount([ev('a')], true, [], undefined, [ev('wed', { role: 'celebrant' }), ev('a')]);
    cmp['choosePass']('platinum-pass');
    await settle();
    expect(cmp['eligible']().map((e: BillingEvent) => e.campaignId)).toEqual(['a', 'wed']);
  });

  it("a celebrant sent here for their own event (not one they made) can still pick it for a pass", async () => {
    const theirs = ev('wed', { title: 'Our wedding', role: 'celebrant' });
    const { cmp, settle } = await mount([ev('a')], true, [theirs]);
    cmp['choosePass']('platinum-pass', 'wed');
    await settle();
    expect(cmp['eligible']().map((e: BillingEvent) => e.campaignId)).toEqual(['wed', 'a']);
    expect(cmp['chosen']()).toBe('wed');
  });

  it("an event this account can't see isn't added; the picker falls back as before", async () => {
    const { cmp, settle } = await mount([ev('a')]);
    cmp['choosePass']('gold-pass', 'nope');
    await settle();
    expect(cmp['eligible']().map((e: BillingEvent) => e.campaignId)).toEqual(['a']);
    expect(cmp['chosen']()).toBe('a');
  });

  it('goes straight to checkout for the event chosen', async () => {
    const { cmp, settle, checkout } = await mount([ev('a'), ev('z')]);
    cmp['choosePass']('platinum-pass');
    await settle();
    cmp['chosen'].set('z');
    cmp['confirmPass']();
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'platinum-pass', campaignId: 'z' }));
  });

  describe('pricing 2026-11: server perks, the AI designer tick (docs/PRICING-2026-11.md)', () => {
    /** A catalog with the server's own bullets, so the cards are proven to draw those, not the page's. */
    const served: PlanCatalog = {
      ...PLAN_CATALOG,
      plans: PLAN_CATALOG.plans.map((p) => ({ ...p, perks: [`Server perk one for ${p.kind}`, `Server perk two for ${p.kind}`] })),
    };
    const card = (el: HTMLElement, name: string) =>
      Array.from(el.querySelectorAll('ui-plan-card')).find((c) => c.querySelector('.name')?.textContent?.trim() === name) as HTMLElement;

    it("every card's bullets are the server's perks, as they come", async () => {
      const { el } = await mount([], true, [], undefined, undefined, served);
      for (const [name, kind] of [['Gold pass', 'GoldPass'], ['Platinum pass', 'PlatinumPass'], ['Premium', 'Premium'], ['Studio', 'Venue']]) {
        const items = Array.from(card(el, name).querySelectorAll('.features li')).map((li) => li.textContent?.trim());
        expect(items).toEqual([`Server perk one for ${kind}`, `Server perk two for ${kind}`]);
      }
    });

    it('Premium: the AI designer tick changes the button to MVR 154 and buys premium-ai-monthly; untouched it buys premium-monthly', async () => {
      const { el, button, checkout, fixture } = await mount([], true, [], undefined, undefined, served);
      // Closing the review without paying frees the button for the next try.
      checkout.start.mockReturnValue(of({ kind: 'cancelled' }) as never);
      const premium = card(el, 'Premium');
      expect(premium.textContent).toContain('Add the AI designer');
      expect(premium.textContent).toContain('+MVR 77 a month, about $5');
      button(/Subscribe · MVR 77 a month/)!.querySelector('button')!.click();
      expect(checkout.start).toHaveBeenLastCalledWith(expect.objectContaining({ item: 'premium-monthly' }));

      (premium.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(card(el, 'Premium').textContent).toContain('MVR 154');
      button(/Subscribe · MVR 154 a month/)!.querySelector('button')!.click();
      expect(checkout.start).toHaveBeenLastCalledWith(expect.objectContaining({ item: 'premium-ai-monthly' }));
      // Studio has no tick: the AI designer comes with it.
      expect(card(el, 'Studio').textContent).not.toContain('Add the AI designer');
    });

    it('on Premium without the AI designer: no tick, an "Add the AI designer" button (designer-ai-add)', async () => {
      const { el, button, checkout } = await mount([], true, [], { subscriptionTier: 'Premium', subscriptionEndsAt: null, addOns: [{ key: 'designer-ai', active: false, renews: false, endsAt: null }] });
      expect(card(el, 'Premium').querySelector('input[type="checkbox"]')).toBeNull();
      button(/Add the AI designer/)!.querySelector('button')!.click();
      expect(checkout.start).toHaveBeenLastCalledWith(expect.objectContaining({ item: 'designer-ai-add' }));
    });
  });
});

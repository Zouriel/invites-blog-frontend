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
import { BillingEvent } from '../../shared/utils/types/api.types';
import { PricingComponent } from './pricing.component';
import { pricingFaq } from './pricing-faq';

const ev = (id: string, over: Partial<BillingEvent> = {}): BillingEvent => ({
  campaignId: id, title: `Event ${id}`, eventStartAt: '2026-12-20T12:00:00Z', kind: 'invitation', plan: 'Free',
  passUntil: null, keepPhotosUntil: null, coveredUntil: null, phase: 'Active',
  sending: { included: 0, extra: 0, used: 0, total: 0, left: 0 }, atVenue: false, pass: 'None', passActive: false,
  offer: {} as BillingEvent['offer'], isDraft: false, ...over,
});

async function mount(events: BillingEvent[], signedIn = true, others: BillingEvent[] = [], account?: Record<string, unknown>, forYou?: BillingEvent[]) {
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
      { provide: ApiService, useValue: { plans: vi.fn(() => of(PLAN_CATALOG)), billing: vi.fn(() => of({ events, forYou })), billingEvent } },
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
    expect(tier(button(/Subscribe · MVR 200 a month/))).toBe('premium');
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

  it('sells Studio (plan kind Venue) on a full plan card beside Premium: MVR 775 a month, about $50, its benefits, no staff or discount', async () => {
    const { el, button } = await mount([]);
    const cards = Array.from(el.querySelectorAll('ui-plan-card'));
    const venueCard = cards.find((c) => (c.textContent ?? '').includes('Get Studio'))!;
    expect(venueCard).toBeTruthy();
    // In the same grid as Premium.
    expect(venueCard.parentElement).toBe(cards.find((c) => (c.textContent ?? '').includes('Subscribe ·'))!.parentElement);
    const venue = (venueCard.textContent ?? '').replace(/\s+/g, ' ');
    expect(venue).toContain('MVR 775');
    expect(venue).toContain('a month');
    expect(venue).toContain('about $50');
    expect(venue).toContain('Studio');
    for (const benefit of ['10 GB on every event you organise', 'No “Made with invites.blog” mark', 'Face grouping', 'Photos kept while you’re on Studio',
      'Your picture and name on its albums, QR cards and posts']) expect(venue).toContain(benefit);
    expect(venue).toContain('go back to Free like an ended Premium pass');
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

  it('on Studio (kind Venue): the card is marked as yours and leads to Billing instead of selling', async () => {
    const { el, button } = await mount([], true, [], { subscriptionTier: 'Venue', subscriptionEndsAt: null });
    expect(button(/Get Studio/)).toBeUndefined();
    expect(button(/Your plan/)).toBeTruthy();
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
});

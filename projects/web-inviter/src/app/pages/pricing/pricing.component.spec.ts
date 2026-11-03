import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';
import { SessionStore } from '../../shared/services/session.store';
import { PLAN_CATALOG } from '../../shared/utils/plans';
import { BillingEvent } from '../../shared/utils/types/api.types';
import { PricingComponent } from './pricing.component';

const ev = (id: string, over: Partial<BillingEvent> = {}): BillingEvent => ({
  campaignId: id, title: `Event ${id}`, eventStartAt: '2026-12-20T12:00:00Z', kind: 'invitation', plan: 'Free',
  passUntil: null, keepPhotosUntil: null, coveredUntil: null, phase: 'Active',
  sending: { included: 0, extra: 0, used: 0, total: 0, left: 0 }, atVenue: false, pass: 'None', passActive: false,
  offer: {} as BillingEvent['offer'], isDraft: false, ...over,
});

async function mount(events: BillingEvent[], signedIn = true) {
  const checkout = { start: vi.fn(() => EMPTY) };
  TestBed.configureTestingModule({
    imports: [PricingComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { plans: vi.fn(() => of(PLAN_CATALOG)), billing: vi.fn(() => of({ events })) } },
      { provide: CheckoutFlow, useValue: checkout },
      { provide: UiToastService, useValue: { info: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(signedIn), account: signal(signedIn ? { id: 'me', subscriptionTier: 'None' } : null) } },
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

  it('goes straight to checkout for the event chosen', async () => {
    const { cmp, settle, checkout } = await mount([ev('a'), ev('z')]);
    cmp['choosePass']('platinum-pass');
    await settle();
    cmp['chosen'].set('z');
    cmp['confirmPass']();
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'platinum-pass', campaignId: 'z' }));
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckoutQuote } from '../utils/types/api.types';
import { CheckoutFlow } from './checkout-flow.service';
import { CheckoutReviewComponent } from './checkout-review.component';

const quote = (over: Partial<CheckoutQuote>): CheckoutQuote => ({
  available: true, item: 'premium-monthly', description: 'Premium, a month', amount: 77, currency: 'MVR', mvrPerUsd: 15.42,
  termsVersion: 't', message: null, inquireTopic: null, chargeAmount: 77, chargeCurrency: 'MVR', ...over,
});

function mount(q: CheckoutQuote) {
  const flow = { review: signal({ quote: q, start: { item: q.item }, done: new Subject() }), paying: signal(false), cancel: () => {}, pay: () => {} };
  TestBed.configureTestingModule({ imports: [CheckoutReviewComponent], providers: [provideRouter([]), { provide: CheckoutFlow, useValue: flow }] });
  const fixture = TestBed.createComponent(CheckoutReviewComponent);
  fixture.detectChanges();
  return () => (document.body.textContent ?? '').replace(/\s+/g, ' ');
}

/** The review shows what is bought on the same card as Plans, and what each renewal charges. */
describe('review step for Premium and the AI designer', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Premium with the AI designer: the Premium card with the tick on, MVR 154 now and at each renewal', () => {
    const text = mount(quote({ item: 'premium-ai-monthly', description: 'Premium with AI designer, a month', amount: 154, chargeAmount: 154, renewsAmount: 154, renewsItem: 'premium-ai-monthly' }));
    expect(document.querySelector('app-plan-offer-card ui-plan-card .name')?.textContent?.trim()).toBe('Premium');
    expect(text()).toContain('Add the AI designer');
    expect(text()).toContain('Pay MVR 154');
    expect(text()).toContain('Renews automatically every month for MVR 154');
  });

  it('the AI designer added mid-month: the prorated charge now, until when it covers, then 154 with Premium', () => {
    const text = mount(quote({ item: 'designer-ai-add', description: 'AI designer, rest of this month', amount: 31, chargeAmount: 31, renewsAmount: 154, periodEndsAt: '2026-11-25T08:00:00Z' }));
    expect(text()).toContain('Pay MVR 31');
    expect(text()).toContain('The AI designer switches on for your account');
    expect(text()).toContain('It covers up to');
    expect(text()).toContain('Renews automatically every month for MVR 154');
    expect(document.querySelector('app-plan-offer-card')).toBeNull();
  });
});

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { TERMS_VERSION } from '../utils/constants/company';
import { CheckoutQuote, CheckoutResult, PaymentStatus } from '../utils/types/api.types';
import { CheckoutFlow, CheckoutOutcome } from './checkout-flow.service';

const quote = (over: Partial<CheckoutQuote> = {}): CheckoutQuote => ({
  available: true,
  item: 'party-pass',
  description: 'Party pass · Ali’s birthday',
  amount: 699,
  currency: 'MVR',
  mvrPerUsd: 15.42,
  termsVersion: TERMS_VERSION,
  message: null,
  inquireTopic: 'party',
  chargeAmount: 699,
  chargeCurrency: 'MVR',
  ...over,
});

/**
 * The review step the bank's card rules require: nothing is charged until the buyer has seen the
 * quote and pressed Pay, and Pay always sends the acceptance and the terms version with it.
 */
describe('CheckoutFlow', () => {
  let flow: CheckoutFlow;
  let api: { billingQuote: ReturnType<typeof vi.fn>; billingCheckout: ReturnType<typeof vi.fn>; billingPayment: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let outcomes: CheckoutOutcome[];

  beforeEach(() => {
    api = { billingQuote: vi.fn(), billingCheckout: vi.fn(), billingPayment: vi.fn() };
    toast = { success: vi.fn(), danger: vi.fn(), info: vi.fn() };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        CheckoutFlow,
        { provide: ApiService, useValue: api },
        { provide: UiToastService, useValue: toast },
        { provide: Router, useValue: router },
      ],
    });
    flow = TestBed.inject(CheckoutFlow);
    flow.redirect = vi.fn();
    outcomes = [];
  });

  const start = () =>
    flow
      .start({ item: 'party-pass', campaignId: 'c1', quantity: 1, returnPath: '/dashboard/c1' })
      .subscribe((o) => outcomes.push(o));

  it('shows the review and charges nothing until Pay', () => {
    api.billingQuote.mockReturnValue(of(quote()));
    start();

    expect(flow.review()?.quote.amount).toBe(699);
    expect(api.billingCheckout).not.toHaveBeenCalled();
    expect(outcomes).toEqual([]);
  });

  it('pays with the acceptance and the terms version, then leaves for the bank', () => {
    api.billingQuote.mockReturnValue(of(quote()));
    api.billingCheckout.mockReturnValue(
      of<CheckoutResult>({ available: true, checkoutUrl: 'https://bank/pay', message: null, inquireTopic: null, paymentId: 'p1' }),
    );
    start();
    flow.pay();

    expect(api.billingCheckout).toHaveBeenCalledWith('party-pass', 'c1', 1, '/dashboard/c1', true, TERMS_VERSION);
    expect(flow.redirect).toHaveBeenCalledWith('https://bank/pay');
    expect(outcomes).toEqual([{ kind: 'redirecting' }]);
  });

  it('closing the review charges nothing and reports it cancelled', () => {
    api.billingQuote.mockReturnValue(of(quote()));
    start();
    flow.cancel();

    expect(flow.review()).toBeNull();
    expect(api.billingCheckout).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ kind: 'cancelled' }]);
  });

  it('while payment is off, says where to ask instead and shows no review', () => {
    api.billingQuote.mockReturnValue(of(quote({ available: false, message: 'Being set up', inquireTopic: 'party' })));
    start();

    expect(flow.review()).toBeNull();
    expect(outcomes).toEqual([{ kind: 'unavailable', message: 'Being set up', inquireTopic: 'party' }]);
  });

  it('a refused payment (terms changed) keeps the review open to try again', () => {
    api.billingQuote.mockReturnValue(of(quote()));
    api.billingCheckout.mockReturnValue(throwError(() => new Error('billing_terms_changed')));
    start();
    flow.pay();

    expect(flow.review()).not.toBeNull();
    expect(flow.paying()).toBe(false);
    expect(flow.redirect).not.toHaveBeenCalled();
    expect(outcomes).toEqual([]);
  });

  describe('coming back from the bank', () => {
    const route = (q: Record<string, string>) => ({ snapshot: { queryParamMap: convertToParamMap(q) } }) as unknown as ActivatedRoute;
    const status = (s: PaymentStatus['status']): PaymentStatus =>
      ({ id: 'p1', item: 'party-pass', description: 'Party pass', amount: 199, currency: 'MVR', status: s });

    afterEach(() => vi.useRealTimers());

    it('says nothing when no payment is being returned from', () => {
      let got: unknown = 'unset';
      flow.confirmReturn(route({})).subscribe((s) => (got = s));
      expect(got).toBeNull();
      expect(api.billingPayment).not.toHaveBeenCalled();
    });

    it('says paid only when the server confirms it, and clears the address', () => {
      vi.useFakeTimers();
      api.billingPayment.mockReturnValue(of(status('Paid')));
      let got: unknown;
      flow.confirmReturn(route({ paid: 'p1', state: 'CONFIRMED' })).subscribe((s) => (got = s));
      vi.advanceTimersByTime(0);

      expect(got).toBe('Paid');
      expect(toast.success).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalled();
    });

    it('trusts the server over the bank\'s query string', () => {
      vi.useFakeTimers();
      api.billingPayment.mockReturnValue(of(status('Failed')));
      let got: unknown;
      flow.confirmReturn(route({ paid: 'p1', state: 'CONFIRMED' })).subscribe((s) => (got = s));
      vi.advanceTimersByTime(0);

      expect(got).toBe('Failed');
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.danger).toHaveBeenCalled();
    });

    it('keeps asking while the payment is pending, then reports what it became', () => {
      vi.useFakeTimers();
      api.billingPayment
        .mockReturnValueOnce(of(status('Pending')))
        .mockReturnValueOnce(of(status('Pending')))
        .mockReturnValue(of(status('Paid')));
      let got: unknown;
      flow.confirmReturn(route({ paid: 'p1' })).subscribe((s) => (got = s));
      vi.advanceTimersByTime(0);
      expect(got).toBeUndefined();
      vi.advanceTimersByTime(4000);

      expect(got).toBe('Paid');
      expect(api.billingPayment).toHaveBeenCalledTimes(3);
    });

    it('gives up after twenty seconds and says it is still being confirmed', () => {
      vi.useFakeTimers();
      api.billingPayment.mockReturnValue(of(status('Pending')));
      let got: unknown;
      flow.confirmReturn(route({ paid: 'p1' })).subscribe((s) => (got = s));
      vi.advanceTimersByTime(20000);

      expect(got).toBe('Pending');
      expect(api.billingPayment).toHaveBeenCalledTimes(10);
      expect(toast.info).toHaveBeenCalled();
    });
  });
});

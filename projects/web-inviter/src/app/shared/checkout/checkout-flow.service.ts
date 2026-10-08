import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, finalize, of, timer } from 'rxjs';
import { catchError, filter, map, switchMap, take, takeWhile, last } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { TERMS_VERSION } from '../utils/constants/company';
import { BillingItem, CheckoutQuote, PaymentStatus } from '../utils/types/api.types';

export type CheckoutStart = {
  item: BillingItem;
  campaignId?: string | null;
  quantity?: number;
  /** A path on this site to come back to after paying; the billing page when left out. */
  returnPath?: string;
};

/**
 * How a checkout ended, for the page that started it: off to the bank's page, closed without paying,
 * or not possible online yet (with where to ask instead).
 */
export type CheckoutOutcome =
  | { kind: 'redirecting' }
  | { kind: 'cancelled' }
  | { kind: 'unavailable'; message: string | null; inquireTopic: string | null };

type Review = { quote: CheckoutQuote; start: CheckoutStart; done: Subject<CheckoutOutcome> };

/**
 * The one way to buy anything. It shows the review step (what it is, the total in MVR, who charges
 * it and where, the refund terms, the cards accepted, and an "I agree" box) before handing over to
 * the bank's payment page.
 *
 * <p>That step is not optional: Bank of Maldives' card rules require the total, the currency, the
 * merchant's country and the purchase terms on screen, and accepted, before paying. The server
 * enforces the acceptance too, so a page that skipped this would simply be refused.</p>
 */
@Injectable({ providedIn: 'root' })
export class CheckoutFlow {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly router = inject(Router);

  /** The review being shown, if any. Read by the review modal in the app shell. */
  readonly review = signal<Review | null>(null);
  readonly paying = signal(false);

  /** Leaves for the bank's page. A field so tests can watch it instead of navigating. */
  redirect = (url: string): void => {
    window.location.href = url;
  };

  /** Opens the review for one item. Completes with how it ended. */
  start(start: CheckoutStart): Observable<CheckoutOutcome> {
    return new Observable<CheckoutOutcome>((out) => {
      const sub = this.api.billingQuote(start.item, start.campaignId, start.quantity).subscribe({
        next: (quote) => {
          if (!quote.available) {
            out.next({ kind: 'unavailable', message: quote.message, inquireTopic: quote.inquireTopic });
            out.complete();
            return;
          }
          const done = new Subject<CheckoutOutcome>();
          done.subscribe(out);
          this.review.set({ quote, start, done });
        },
        error: (e) => out.error(e),
      });
      return () => sub.unsubscribe();
    });
  }

  /** The buyer closed the review without paying. */
  cancel(): void {
    const r = this.review();
    if (!r || this.paying()) return;
    this.review.set(null);
    r.done.next({ kind: 'cancelled' });
    r.done.complete();
  }

  /** The buyer accepted the terms and pressed Pay: off to the bank's page. */
  pay(): void {
    const r = this.review();
    if (!r || this.paying()) return;
    const s = r.start;
    this.paying.set(true);
    this.api
      .billingCheckout(s.item, s.campaignId, s.quantity, s.returnPath, true, TERMS_VERSION)
      .pipe(finalize(() => this.paying.set(false)))
      .subscribe({
        next: (res) => {
          if (res.available && res.checkoutUrl) {
            r.done.next({ kind: 'redirecting' });
            r.done.complete();
            this.redirect(res.checkoutUrl);
            return;
          }
          this.review.set(null);
          r.done.next({ kind: 'unavailable', message: res.message, inquireTopic: res.inquireTopic });
          r.done.complete();
        },
        // The API service shows the error (for example, terms changed since the page opened); the
        // review stays open so the buyer can try again or close it.
        error: () => {},
      });
  }

  /**
   * Back from the bank's page with `?paid=<payment>`: find out what really happened and say so. The
   * webhook usually lands first; if it hasn't, the server asks the bank. Checked every two seconds for
   * up to twenty, then left to the webhook. The query is cleared either way, so a reload says nothing.
   * Emits the final status once (null when there was no payment to check).
   */
  confirmReturn(route: ActivatedRoute): Observable<PaymentStatus['status'] | null> {
    const query = route.snapshot.queryParamMap;
    const paid = query.get('paid');
    if (!paid) return of(null);
    const clear = () =>
      void this.router.navigate([], {
        relativeTo: route,
        queryParams: { paid: null, transactionId: null, state: null, signature: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

    return timer(0, 2000).pipe(
      take(10),
      switchMap(() => this.api.billingPayment(paid).pipe(catchError(() => of(null)))),
      filter((p): p is PaymentStatus => !!p),
      takeWhile((p) => p.status === 'Pending', true),
      last(),
      map((p) => p.status),
      catchError(() => of('Pending' as const)),
      map((status) => {
        clear();
        if (status === 'Paid') this.toast.success('Payment received. Thank you!');
        else if (status === 'Failed') this.toast.danger('The payment didn’t go through, and you haven’t been charged. You can try again.');
        else this.toast.info('We’re confirming your payment with the bank. It will show here within a few minutes.');
        return status;
      }),
    );
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiModal } from '@zouriel/ui/dialog';
import { UiCheckbox } from '@zouriel/ui/form';
import { CardBrandsComponent } from '../brand/card-brands.component';
import { COMPANY } from '../utils/constants/company';
import { catalog, designerAddOn, mvr, plan, usd } from '../utils/plans';
import { localDate } from '../utils/event-time';
import { PlanOfferCardComponent, SubscriptionKind } from '../plans/plan-offer-card.component';
import { BillingItem } from '../utils/types/api.types';
import { CheckoutFlow } from './checkout-flow.service';

/** When what's bought starts: delivery, in the bank's words. */
const DELIVERY: Record<BillingItem, string> = {
  'gold-pass': 'The Gold pass switches on for this event as soon as the payment is confirmed, and covers it for a year.',
  'platinum-pass': 'The Platinum pass switches on for this event as soon as the payment is confirmed, and covers it for a year.',
  'gold-extension': "The event's cover is extended by a year as soon as the payment is confirmed.",
  'platinum-extension': "The event's cover is extended by a year as soon as the payment is confirmed.",
  'keep-photos': "The event's albums are kept online for another year as soon as the payment is confirmed.",
  sending: "The emails are added to this event's sending allowance as soon as the payment is confirmed.",
  'premium-monthly': 'Premium switches on for your account for a month as soon as the payment is confirmed.',
  'premium-ai-monthly':
    'Premium with the AI designer switches on for your account for a month as soon as the payment is confirmed.',
  'designer-ai-add':
    'The AI designer switches on for your account as soon as the payment is confirmed. This charge covers the rest of the month you have paid for; after that it renews with Premium.',
  'photographer-monthly': 'Photographer switches on for your account for a month as soon as the payment is confirmed.',
  'venue-monthly': 'Studio switches on for your account for a month as soon as the payment is confirmed.',
};

/** The refund terms that apply to this item, said before paying (a limited refund must be). */
export function refundLine(item: BillingItem): string {
  if (item === 'sending') return 'Emailed invitations are not refundable once sent.';
  if (item === 'premium-monthly' || item === 'premium-ai-monthly' || item === 'venue-monthly' || item === 'photographer-monthly')
    return 'Turning off renewal stops future charges; the plan runs to the end of the period paid for, which is not refunded.';
  if (item === 'designer-ai-add')
    return 'Turning the AI designer off stops it renewing; it stays on to the end of the month paid for, which is not refunded.';
  return 'Refundable until guests start adding photos or invitations are sent under this event; after that, not refundable.';
}

/**
 * The review step before paying, shown for every purchase (see {@link CheckoutFlow}): the item, the
 * total in MVR, who charges it and where, when it's delivered, the refund terms, the cards accepted,
 * the advice to keep a record, and an "I agree" box that Pay waits for. Lives once, in the app shell.
 */
@Component({
  selector: 'app-checkout-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, UiButton, UiCheckbox, FormsModule, RouterLink, CardBrandsComponent, PlanOfferCardComponent],
  template: `
    <ui-modal [open]="!!flow.review()" (openChange)="$event ? null : flow.cancel()" title="Review and pay" size="md">
      @if (flow.review(); as r) {
        <div class="review">
          <div class="review__item">
            <span class="review__what">{{ r.quote.description }}</span>
            <span class="review__total">
              <strong>{{ charged() }}</strong>
              <small>{{ approx() }}</small>
            </span>
          </div>

          <!-- A plan: the same card as on Plans, so what is bought reads the same where it was chosen. -->
          @if (planKind(); as kind) {
            <app-plan-offer-card class="review__card" [kind]="kind" mode="show" [withAi]="withAi()" />
          }

          <ul class="review__facts">
            <li>
              Charged in {{ chargeCurrencyName() }} ({{ r.quote.chargeCurrency }}) by {{ company.acquirer }}. Merchant:
              {{ company.legalName }} ({{ company.tradingName }}), {{ company.country }}.
            </li>
            <li>{{ delivery() }}@if (coversUntil(); as until) { It covers up to {{ until }}. }</li>
            @if (renews(); as every) {
              <li>
                <strong>Renews automatically</strong> every {{ every }}{{ renewsAt() ? ' for ' + renewsAt() : '' }} at the price then in force, by charging the card
                you pay with now, until you turn off automatic renewal under Billing. You can turn it off at any time.
              </li>
            }
            <li>{{ refund() }} <a routerLink="/refunds" target="_blank">Refund policy</a></li>
            <li>Please keep a copy of your payment confirmation and of our policies.</li>
          </ul>

          <div class="review__cards">
            <app-card-brands [height]="40" />
            <span>You'll enter your card on the bank's secure page. We never see your card details.</span>
          </div>

          <ui-checkbox [ngModel]="agreed()" (ngModelChange)="agreed.set($event)" [ngModelOptions]="{ standalone: true }">
            I have read and agree to the
            <a routerLink="/terms" target="_blank">Terms</a>,
            <a routerLink="/refunds" target="_blank">Refunds and delivery</a> and
            <a routerLink="/privacy" target="_blank">Privacy</a> policies.
          </ui-checkbox>
        </div>
      }
      <div modal-footer>
        <ui-button variant="ghost" [disabled]="flow.paying()" (click)="flow.cancel()">Cancel</ui-button>
        <ui-button variant="primary" [disabled]="!agreed()" [loading]="flow.paying()" (click)="flow.pay()">
          Pay {{ charged() }}
        </ui-button>
      </div>
    </ui-modal>
  `,
  styles: [
    `
      .review {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .review__item {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.9rem;
        border-bottom: 1px solid var(--ui-color-border);
      }
      .review__what {
        font-weight: 600;
      }
      .review__total {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        white-space: nowrap;
      }
      .review__total strong {
        font-size: 1.25rem;
      }
      .review__total small,
      .review__cards span {
        color: var(--ui-color-text-muted);
        font-size: 0.82rem;
      }
      .review__facts {
        margin: 0;
        padding-left: 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.9rem;
        line-height: 1.5;
      }
      .review__card {
        max-width: 26rem;
      }
      .review__cards {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
    `,
  ],
})
export class CheckoutReviewComponent {
  protected readonly flow = inject(CheckoutFlow);
  protected readonly company = COMPANY;
  protected readonly agreed = signal(false);

  /** Exactly what the card is charged, in the currency it's charged in. */
  protected readonly charged = computed(() => {
    const q = this.flow.review()?.quote;
    if (!q) return '';
    return q.chargeCurrency === q.currency ? mvr(q.amount) : `${q.chargeCurrency} ${q.chargeAmount.toFixed(2)}`;
  });
  protected readonly approx = computed(() => {
    const q = this.flow.review()?.quote;
    if (!q) return '';
    return q.chargeCurrency === q.currency
      ? `${usd(q.amount, q.mvrPerUsd)}, charged in MVR`
      : `${mvr(q.amount)} at ${q.mvrPerUsd} to the dollar, charged in ${q.chargeCurrency}`;
  });
  protected readonly chargeCurrencyName = computed(() =>
    this.flow.review()?.quote.chargeCurrency === 'USD' ? 'US dollars' : this.company.currencyName,
  );
  protected readonly delivery = computed(() => {
    const item = this.flow.review()?.quote.item;
    return item ? DELIVERY[item] : '';
  });
  /** A plan renews by itself; this says how often, or nothing for a one-off purchase. */
  protected readonly renews = computed(() => {
    const item = this.flow.review()?.quote.item;
    return item === 'premium-monthly' || item === 'premium-ai-monthly' || item === 'venue-monthly' || item === 'photographer-monthly'
      || item === 'designer-ai-add'
      ? 'month'
      : null;
  });
  /** For the AI designer added mid-month: the end of the paid month this charge covers. */
  protected readonly coversUntil = computed(() => {
    const end = this.flow.review()?.quote.periodEndsAt;
    return end ? localDate(end) : null;
  });
  /** The plan bought, drawn as its card on the review. */
  protected readonly planKind = computed<SubscriptionKind | null>(() => {
    const item = this.flow.review()?.quote.item;
    if (item === 'photographer-monthly') return 'Photographer';
    return item === 'venue-monthly' ? 'Venue' : item === 'premium-monthly' || item === 'premium-ai-monthly' ? 'Premium' : null;
  });
  protected readonly withAi = computed(() => this.flow.review()?.quote.item === 'premium-ai-monthly');
  /** What each renewal charges: "MVR 154" for Premium with the AI designer, including after adding it mid-month. */
  protected readonly renewsAt = computed(() => {
    const q = this.flow.review()?.quote;
    if (q?.renewsAmount) return mvr(q.renewsAmount);
    const item = q?.item;
    const premium = plan('Premium').price;
    const ai = designerAddOn(catalog()).price;
    if (item === 'premium-ai-monthly' || item === 'designer-ai-add') return mvr(premium + ai);
    if (item === 'premium-monthly') return mvr(premium);
    if (item === 'venue-monthly') return mvr(plan('Venue').price);
    if (item === 'photographer-monthly') return mvr(plan('Photographer').price);
    return null;
  });
  protected readonly refund = computed(() => {
    const item = this.flow.review()?.quote.item;
    return item ? refundLine(item) : '';
  });

  constructor() {
    // Every review starts unticked: agreeing is for this purchase, not the last one.
    effect(() => {
      this.flow.review();
      this.agreed.set(false);
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { eventDay } from '../../shared/utils/event-time';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiToastService, UiModal } from '@zouriel/ui/dialog';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';
import { SessionStore } from '../../shared/services/session.store';
import { CHARGE } from '../../shared/utils/constants/company';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiButton } from '@zouriel/ui/button';
import { UiRadioGroup } from '@zouriel/ui/form';
import { UiPlanCard, UiPlanCompare, UiPlanGrid } from '@zouriel/ui/plans';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { BACK_TO_FREE, catalog, formatBytes, mvr, planTier, usd, windowLine } from '../../shared/utils/plans';
import { BillingEvent, BillingItem, Plan, PlanCatalog } from '../../shared/utils/types/api.types';
import { pricingFaq } from './pricing-faq';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { CardBrandsComponent } from '../../shared/brand/card-brands.component';

export { pricingFaq } from './pricing-faq';

/** A pass bought from this page: which, for which event. */
type PassItem = 'gold-pass' | 'platinum-pass';

/** The value the picker uses for "make a new event for it". */
const NEW_EVENT = 'new';

/**
 * Plans (docs/PLANS-UX.md): every event starts free; a pass for one event (Gold, Platinum) or Premium
 * for every event, each bought right here with a button in its tier's colour. A pass asks which event
 * it is for and goes straight to checkout. Prerendered, from the catalog the server enforces.
 */
@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SettingsBackComponent, CardBrandsComponent, FormsModule, RouterLink,
    UiAccordion, UiAccordionItem, UiButton, UiModal, UiPlanCard, UiPlanCompare, UiPlanGrid, UiRadioGroup, UiText,
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  private readonly api = inject(ApiService);
  private readonly checkout = inject(CheckoutFlow);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(UiToastService);

  protected readonly charge = CHARGE;
  protected readonly backToFree = BACK_TO_FREE;
  protected readonly mvr = mvr;
  protected readonly planTier = planTier;
  protected readonly faq = pricingFaq();

  protected readonly catalog = signal<PlanCatalog>(catalog());
  private readonly byKind = computed(() => new Map(this.catalog().plans.map((p) => [p.kind, p])));
  protected plan(kind: string): Plan | undefined {
    return this.byKind().get(kind as Plan['kind']);
  }
  protected readonly free = computed(() => this.plan('Free'));
  protected readonly gold = computed(() => this.plan('GoldPass'));
  protected readonly platinum = computed(() => this.plan('PlatinumPass'));
  protected readonly premium = computed(() => this.plan('Premium'));
  protected readonly venue = computed(() => this.plan('Venue'));
  protected readonly freeSize = computed(() => formatBytes(this.free()?.eventBytes ?? 0));

  /** The signed-in account's own plan, for "Your plan" on its card. */
  protected readonly signedIn = computed(() => this.session.isSignedIn());
  protected readonly onPremium = computed(() => {
    const a = this.session.account();
    return !!a && a.subscriptionTier === 'Premium' && (!a.subscriptionEndsAt || new Date(a.subscriptionEndsAt) > new Date());
  });
  protected readonly onVenue = computed(() => {
    const a = this.session.account();
    return !!a && a.subscriptionTier === 'Venue' && (!a.subscriptionEndsAt || new Date(a.subscriptionEndsAt) > new Date());
  });

  /** Which button is waiting on the server. */
  protected readonly buying = signal<BillingItem | null>(null);

  constructor() {
    // Only a catalog in the shape this page reads: an older server (or one mid-deploy) keeps the
    // built-in one rather than drawing an empty page.
    this.api.plans().subscribe({ next: (c) => c?.keepPhotos && c.plans?.length && this.catalog.set(c), error: () => {} });
    // Back from signing in, or from Billing's "Add a pass": open the picker for that pass and event.
    const q = this.route.snapshot.queryParamMap;
    this.forEvent = q.get('event');
    const want = q.get('pass');
    if ((want === 'gold' || want === 'platinum') && this.signedIn()) {
      this.choosePass(want === 'gold' ? 'gold-pass' : 'platinum-pass', q.get('event'));
    }
  }

  // ---------- what each card says ----------

  protected priceOf(p: Plan | undefined): string {
    return !p ? '' : p.price === 0 ? 'MVR 0' : mvr(p.price);
  }

  protected usdOf(p: Plan | undefined): string {
    return !p || p.price === 0 ? '' : `about ${usd(p.price, this.catalog().mvrPerUsd)}`;
  }

  protected readonly goldFeatures = computed(() => {
    const p = this.gold();
    if (!p) return [];
    return [
      `${formatBytes(p.eventBytes ?? 0)} for photos and videos, ${p.maxBuckets} albums`,
      `Guests add photos ${windowLine(p.maxWindowDays)}`,
      `${p.includedInvites} invitations emailed for you`,
      'No “Made with invites.blog” mark',
      `Everything kept for a year, then ${this.freeSize()} forever`,
    ];
  });

  protected readonly platinumFeatures = computed(() => {
    const p = this.platinum();
    if (!p) return [];
    return [
      'Everything in Gold, plus:',
      `${formatBytes(p.eventBytes ?? 0)}, up to ${p.maxBuckets} albums (nikah, reception, after-party)`,
      `Guests add photos ${windowLine(p.maxWindowDays)}`,
      'Private albums, for only some guests',
      `${p.includedInvites} invitations emailed for you`,
    ];
  });

  protected readonly premiumFeatures = computed(() => {
    const p = this.premium();
    if (!p) return [];
    return [
      `${formatBytes(p.eventBytes ?? 0)} for photos and videos on every event you organise`,
      'No “Made with invites.blog” mark on any of them',
      `Everything kept while you subscribe, then ${this.freeSize()} each forever`,
      'A Gold or Platinum pass still adds more to any one event',
    ];
  });

  /** The comparison, collapsed under the cards. */
  protected readonly comparePlans = computed(() => [
    { key: 'Free', name: 'Free', tier: null },
    { key: 'GoldPass', name: 'Gold', tier: 'gold' as const },
    { key: 'PlatinumPass', name: 'Platinum', tier: 'platinum' as const },
    { key: 'Premium', name: 'Premium', tier: 'premium' as const },
  ]);

  protected readonly compareRows = computed(() => {
    const ps = ['Free', 'GoldPass', 'PlatinumPass', 'Premium'].map((k) => [k, this.plan(k)] as const);
    const row = (label: string, value: (p: Plan) => string | boolean | null) => ({
      label,
      values: Object.fromEntries(ps.map(([k, p]) => [k, p ? value(p) : null])),
    });
    return [
      row('Price', (p) => (p.price === 0 ? 'Free' : `${mvr(p.price)} ${p.kind === 'Premium' ? 'a month' : 'once'}`)),
      row('Invitations, designs, guests and replies', () => true),
      row('Photo and video space', (p) => `${formatBytes(p.eventBytes ?? 0)}${p.kind === 'Premium' ? ' every event' : ''}`),
      row('Albums', (p) => String(p.maxBuckets ?? 1)),
      row('Guests add photos', (p) => ((p.maxWindowDays ?? 1) > 1 ? `${p.maxWindowDays} days` : 'Day before to day after')),
      row('Private albums', (p) => p.privateAlbums),
      row('Invitations emailed for you', (p) => (p.includedInvites ? `${p.includedInvites}` : false)),
      row('No “Made with” mark', (p) => !p.branded),
      row('Photos kept', (p) =>
        p.kind === 'Free' ? 'Forever' : p.kind === 'Premium' ? `All while subscribed, then ${this.freeSize()} forever` : `All for a year, then ${this.freeSize()} forever`),
    ];
  });

  // ---------- buying a pass: which event, then checkout ----------

  protected readonly picking = signal(false);
  protected readonly pickingItem = signal<PassItem>('gold-pass');
  protected readonly events = signal<BillingEvent[] | null>(null);
  protected readonly chosen = signal<string | null>(null);
  /** The event Billing's "Add a pass" came from: chosen in the picker when it opens. */
  private forEvent: string | null = null;

  /** The account's events that can take this pass: not a save the date, not already on it (or more). */
  protected readonly eligible = computed(() =>
    (this.events() ?? []).filter((e) =>
      e.kind !== 'saveTheDate'
      && !(e.passActive && (e.pass === 'Platinum' || (this.pickingItem() === 'gold-pass' && e.pass === 'Gold')))),
  );

  protected readonly pickOptions = computed(() => [
    ...this.eligible().map((e) => ({
      value: e.campaignId,
      label: `${e.title} · ${eventDay(e.eventStartAt, e.timeZone, 'short')}${e.isDraft ? ' · not finished' : ''}`,
    })),
    { value: NEW_EVENT, label: 'A new event' },
  ]);

  protected readonly pickTitle = computed(() => (this.pickingItem() === 'gold-pass' ? 'Gold pass' : 'Platinum pass') + ': which event is it for?');

  protected choosePass(item: PassItem, eventId?: string | null): void {
    if (!this.session.isSignedIn()) {
      const pass = item === 'gold-pass' ? 'gold' : 'platinum';
      void this.router.navigate(['/login'], { queryParams: { next: `/pricing?pass=${pass}` } });
      return;
    }
    this.pickingItem.set(item);
    this.chosen.set(eventId ?? this.forEvent);
    this.picking.set(true);
    this.api.billing().subscribe({
      next: (o) => {
        this.events.set(o.events);
        const ids = this.eligible().map((e) => e.campaignId);
        // One event to choose from: chosen already, but still shown so the person sees which.
        if (!this.chosen() || !ids.includes(this.chosen()!)) this.chosen.set(ids.length === 1 ? ids[0] : ids.length ? null : NEW_EVENT);
      },
      error: () => {
        this.events.set([]);
        this.chosen.set(NEW_EVENT);
      },
    });
  }

  protected confirmPass(): void {
    const id = this.chosen();
    if (!id) return;
    this.picking.set(false);
    if (id === NEW_EVENT) {
      // A new event takes its pass at the plan step, before anything is sent.
      void this.router.navigate(['/events/new']);
      return;
    }
    this.pay(this.pickingItem(), id);
  }

  /** Subscriptions: signed out, sign in first and come back. */
  protected subscribe(item: 'premium-monthly' | 'venue-monthly'): void {
    if (!this.session.isSignedIn()) {
      void this.router.navigate(['/login'], { queryParams: { next: '/pricing' } });
      return;
    }
    this.pay(item, null);
  }

  /**
   * One way to pay: the review step, then the bank's page. While online payment is off, to "Ask us"
   * with the topic and event filled in.
   */
  private pay(item: BillingItem, campaignId: string | null): void {
    if (this.buying()) return;
    this.buying.set(item);
    this.checkout.start({ item, campaignId, returnPath: '/billing' }).subscribe({
      next: (r) => {
        this.buying.set(null);
        if (r.kind !== 'unavailable') return;
        if (r.message) this.toast.info(r.message);
        void this.router.navigate(['/inquire'], {
          queryParams: { topic: r.inquireTopic ?? 'gold', ...(campaignId ? { event: campaignId } : {}) },
        });
      },
      error: () => this.buying.set(null),
    });
  }
}

import { EventDayPipe, LocalDatePipe } from '../../shared/pipes/event-time.pipe';
import { localDate } from '../../shared/utils/event-time';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { catalog, designerAddOn, designerAiOf, formatBytes, mvr, plan, planLabel, planTier, usd } from '../../shared/utils/plans';
import { PlanOfferCardComponent } from '../../shared/plans/plan-offer-card.component';
import { SessionStore } from '../../shared/services/session.store';
import { BillingEvent, BillingItem, BillingOverview } from '../../shared/utils/types/api.types';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';

/**
 * Billing: what the account is on, what each of its events has and can have (a pass, another year of
 * it, emails, keeping the photos), and what has been paid. Every "buy" goes through one call (billingCheckout); while online
 * payment is switched off on the server it answers "not yet", and the page sends the person to "Ask
 * us" with the right topic instead — so switching the gateway on changes nothing here.
 */
@Component({
  selector: 'app-billing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanOfferCardComponent, SettingsBackComponent, EventDayPipe, LocalDatePipe, NgTemplateOutlet, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState, UiSpinner, UiText],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent {
  private readonly api = inject(ApiService);
  private readonly checkout = inject(CheckoutFlow);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(UiToastService);

  protected readonly overview = signal<BillingOverview | null>(null);
  protected readonly failed = signal(false);
  /** Which button is waiting on the server: `item` or `item:campaignId`. */
  protected readonly busy = signal<string | null>(null);

  protected readonly mvr = mvr;
  protected readonly planLabel = planLabel;
  protected readonly planTier = planTier;
  /** What Premium gives each event, from the catalog: "2 GB". */
  protected readonly premiumSpace = formatBytes(plan('Premium').eventBytes ?? 0);

  protected readonly isPremium = computed(() => {
    const a = this.overview()?.account;
    return !!a && a.tier === 'Premium' && a.active;
  });
  /** On Studio (the server's plan kind Venue). */
  protected readonly isStudio = computed(() => {
    const a = this.overview()?.account;
    return !!a && a.tier === 'Venue' && a.active;
  });

  protected readonly stopping = signal(false);

  // ---------- the AI designer on Premium (docs/PRICING-2026-11.md §3) ----------

  private readonly session = inject(SessionStore);
  protected readonly ai = computed(() => designerAiOf(this.overview()?.account.addOns));
  protected readonly aiPrice = computed(() => this.overview()?.prices.designerAiMonthly ?? designerAddOn(catalog()).price);
  /** What Premium renews at with the AI designer. */
  protected readonly withAiMonthly = computed(() => (this.overview()?.prices.premiumMonthly ?? plan('Premium').price) + this.aiPrice());
  protected readonly aiBusy = signal(false);
  /** Premium bought in the app: the AI designer is added or turned off there. */
  protected readonly storePlan = computed(() => !!this.overview()?.account.store);

  /** Another month of the plan as it is: Studio, Premium, or Premium with the AI designer while that is on. */
  protected readonly monthItem = computed<BillingItem>(() =>
    this.isStudio() ? 'venue-monthly' : this.ai()?.active && !this.ai()?.included ? 'premium-ai-monthly' : 'premium-monthly',
  );
  protected readonly monthPrice = computed(() => {
    const o = this.overview();
    if (!o) return 0;
    const item = this.monthItem();
    return item === 'venue-monthly' ? o.prices.venueMonthly : item === 'premium-ai-monthly' ? this.withAiMonthly() : o.prices.premiumMonthly;
  });

  /** One line on where the AI designer stands for this Premium. */
  protected readonly aiLine = computed(() => {
    const a = this.ai();
    const store = this.storePlan();
    if (!a || !a.active) return store ? 'Off. Add it in the app you subscribed in.' : `Off. Add it for ${mvr(this.aiPrice())} a month.`;
    if (a.included) return 'Included.';
    if (!a.endsAt) return 'On.';
    if (a.renews) return `On. Renews with Premium at ${mvr(this.withAiMonthly())} a month from ${this.day(a.endsAt)}.`;
    return store
      ? `On until ${this.day(a.endsAt)}. To keep it, choose Premium with the AI designer in the app.`
      : `On until ${this.day(a.endsAt)}. It won't renew unless you keep it (${mvr(this.withAiMonthly())} a month with Premium).`;
  });

  /** Turns renewing the AI designer off or back on. No payment. */
  protected setAiRenewal(on: boolean): void {
    if (this.aiBusy()) return;
    this.aiBusy.set(true);
    this.api.billingDesignerAi(on).subscribe({
      next: (account) => {
        this.aiBusy.set(false);
        const o = this.overview();
        if (o) this.overview.set({ ...o, account: { ...o.account, ...account } });
        const me = this.session.account();
        if (me && account.addOns) this.session.setAccount({ ...me, addOns: account.addOns });
        const until = account.addOns?.find((x) => x.key === 'designer-ai')?.endsAt;
        this.toast.success(
          on
            ? 'The AI designer will renew with Premium.'
            : `The AI designer won't renew. It stays on${until ? ` until ${this.day(until)}` : ' to the end of the month'}.`,
        );
      },
      error: () => this.aiBusy.set(false),
    });
  }

  // ---------- what the page says (docs/PLANS-UX.md: Billing states, Plans sells) ----------

  protected readonly accountTier = computed(() => (this.isPremium() ? 'premium' : null) as 'premium' | null);
  protected readonly accountName = computed(() => (this.isPremium() ? 'Premium' : this.isStudio() ? planLabel('Venue') : 'Free'));
  protected readonly accountLine = computed(() => {
    const free = formatBytes(plan('Free').eventBytes ?? 0);
    if (this.isPremium()) return `Every event you organise gets ${this.premiumSpace} for photos and videos and no "Made with" mark, and keeps everything while you subscribe.`;
    if (this.isStudio()) return `Every event you organise gets ${formatBytes(plan('Venue').eventBytes ?? 0)} for photos and videos, no "Made with" mark and face grouping, and keeps everything while you're on Studio. Your picture and name show on its albums, QR cards and posts.`;
    return `Every event gets ${free} for photos and videos, kept forever. A pass adds more to one event.`;
  });
  protected readonly statusLine = computed(() => {
    const a = this.overview()?.account;
    if (!a) return '';
    if (!a.endsAt) return 'No end date.';
    const on = this.day(a.endsAt);
    const where = a.store === 'app_store' ? ' through the App Store' : a.store === 'google_play' ? ' through Google Play' : '';
    const renews = a.store ? a.storeAutoRenew : !!a.autoRenew;
    return renews ? `Renews${where} on ${on}.` : `Ends on ${on}. It won't renew.`;
  });

  protected day(iso: string): string {
    return localDate(iso);
  }

  /** Whether this account started the event (an older server doesn't say: then it did). */
  protected isOrganiser(e: BillingEvent): boolean {
    return (e.role ?? 'organiser') === 'organiser';
  }

  /** Its organiser's Studio plan has ended and it has no pass of its own: only a Platinum pass keeps its photos. */
  protected venueEnded(e: BillingEvent): boolean {
    return !!e.venueEnded && !e.passActive && e.kind !== 'saveTheDate';
  }

  /** After the date, why an event someone else set up is listed. */
  protected roleLine(e: BillingEvent): string {
    switch (e.role) {
      case 'manager': return ' · You help run it';
      case 'celebrant': return ' · It’s for you';
      default: return '';
    }
  }

  /** What the event's plan means today, in one line. */
  protected eventLine(e: BillingEvent): string {
    const free = formatBytes(plan('Free').eventBytes ?? 0);
    if (e.isDraft) return 'You choose its plan at the last step of setting it up.';
    if (this.venueEnded(e)) {
      const whose = this.isOrganiser(e) ? 'Your' : 'The organiser’s';
      return e.trimAt
        ? `${whose} Studio plan has ended: back to Free on ${this.day(e.trimAt)}, when about ${formatBytes(e.trimBytes ?? 0)} above ${free} will be removed. A Platinum pass keeps everything.`
        : `${whose} Studio plan has ended, so this event is back on Free. A Platinum pass keeps everything.`;
    }
    if (e.trimAt) return `Back to Free on ${this.day(e.trimAt)}: about ${formatBytes(e.trimBytes ?? 0)} above ${free} will be removed. Download everything or extend.`;
    if (e.passActive && e.passUntil) return `${e.pass} pass until ${this.day(e.passUntil)}${e.keepPhotosUntil ? `, everything kept until ${this.day(e.keepPhotosUntil)}` : ''}.`;
    if (e.keepPhotosUntil && new Date(e.keepPhotosUntil) > new Date()) return `Everything kept until ${this.day(e.keepPhotosUntil)}.`;
    if (e.plan === 'Venue') return this.isOrganiser(e) ? 'On your Studio plan: everything kept while you’re on it.' : 'On the organiser’s Studio plan: everything kept while it lasts.';
    if (e.plan === 'Premium') return this.isOrganiser(e) ? 'On your Premium.' : 'On the organiser’s Premium.';
    if (e.pass !== 'None') return `Its ${e.pass} pass has ended: back on Free, ${free} kept forever.`;
    return e.kind === 'saveTheDate' ? 'Free.' : `Free: ${free} of photos, kept forever.`;
  }

  /**
   * Only the actions that mean something for this event now: extend a pass that's ending or ended,
   * keep everything once a pass has ended, more emails when they're nearly used, and a link to add a
   * pass to a free event (bought on Plans, where the passes are compared).
   */
  protected actionsFor(e: BillingEvent): { label: string; item?: BillingItem; quantity?: number; link?: string; query?: Record<string, string> }[] {
    const o = this.overview();
    if (!o || e.isDraft) return [];
    // The organiser's Studio plan has ended: the one thing that keeps its photos, as the warning email says.
    if (this.venueEnded(e)) return [{ label: `Platinum pass · ${mvr(e.offer.platinumPass)}`, item: 'platinum-pass' }];
    const out: { label: string; item?: BillingItem; quantity?: number; link?: string; query?: Record<string, string> }[] = [];
    const soon = Date.now() + 60 * 864e5;
    const ending = e.pass !== 'None' && (!e.passActive || (e.passUntil !== null && new Date(e.passUntil).getTime() < soon));
    if (ending) {
      const platinum = e.pass === 'Platinum';
      out.push({ label: `Extend a year · ${mvr(platinum ? e.offer.platinumExtension : e.offer.goldExtension)}`, item: platinum ? 'platinum-extension' : 'gold-extension' });
    }
    if (e.kind !== 'saveTheDate' && e.pass !== 'None' && !e.passActive) {
      out.push({ label: `Keep everything a year · ${mvr(o.prices.keepPhotos)}`, item: 'keep-photos' });
    }
    if (e.kind !== 'saveTheDate' && !e.passActive && e.pass === 'None' && e.plan !== 'Premium') {
      out.push({ label: 'Add a pass', link: '/pricing', query: { event: e.campaignId } });
    }
    // Emails are bought by whoever sends the invitations: the organiser.
    if (this.isOrganiser(e) && e.sending.total > 0 && e.sending.used >= e.sending.total * 0.8) {
      out.push({ label: `${o.prices.sendingBlockSize} more emails · ${mvr(o.prices.sendingPerBlock)}`, item: 'sending', quantity: 1 });
    }
    return out;
  }

  /** The plan runs to the end of what's paid and then stops, like one bought without renewal. */
  protected stopAutoRenew(): void {
    if (this.stopping()) return;
    this.stopping.set(true);
    this.api.billingStopAutoRenew().subscribe({
      next: (account) => {
        this.stopping.set(false);
        const o = this.overview();
        if (o) this.overview.set({ ...o, account });
        this.toast.success('Automatic renewal is off. Your plan runs to the end of what’s paid.');
      },
      error: () => this.stopping.set(false),
    });
  }

  constructor() {
    this.load();
    // Back from the bank's page: say what really happened, and show it once it has.
    this.checkout.confirmReturn(this.route).subscribe((status) => {
      if (status !== 'Paid') return;
      this.load();
      // What the account may do changed (Premium, the AI designer, Download all): the rest of the site reads it from the session.
      if (this.session.isSignedIn())
        this.api.refreshSession().subscribe({ next: ({ token, account }) => this.session.set(token, account), error: () => {} });
    });
  }

  private load(): void {
    this.api.billing().subscribe({
      next: (o) => this.overview.set(o),
      error: () => this.failed.set(true),
    });
  }

  protected price(amount: number): string {
    const o = this.overview();
    return `${mvr(amount)} (${usd(amount, o?.mvrPerUsd)})`;
  }

  protected busyFor(item: BillingItem, campaignId?: string): boolean {
    return this.busy() === (campaignId ? `${item}:${campaignId}` : item);
  }

  /**
   * One way to buy anything. Available: off to the gateway's page. Not yet: to "Ask us", with the
   * topic and event filled in, so the request reaches us already saying what it's for.
   */
  protected buy(item: BillingItem, campaignId?: string | null, quantity?: number): void {
    if (this.busy()) return;
    this.busy.set(campaignId ? `${item}:${campaignId}` : item);
    this.checkout.start({ item, campaignId, quantity }).subscribe({
      next: (r) => {
        this.busy.set(null);
        if (r.kind !== 'unavailable') return;
        if (r.message) this.toast.info(r.message);
        void this.router.navigate(['/inquire'], {
          queryParams: { topic: r.inquireTopic ?? 'gold', ...(campaignId ? { event: campaignId } : {}) },
        });
      },
      error: () => this.busy.set(null),
    });
  }
}

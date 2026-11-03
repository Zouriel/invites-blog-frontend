import { DatePipe } from '@angular/common';
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
import { formatBytes, mvr, plan, planLabel, planTier, usd } from '../../shared/utils/plans';
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
  imports: [SettingsBackComponent, DatePipe, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState, UiSpinner, UiText],
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
  protected readonly isVenue = computed(() => {
    const a = this.overview()?.account;
    return !!a && a.tier === 'Venue' && a.active;
  });

  protected readonly stopping = signal(false);

  // ---------- what the page says (docs/PLANS-UX.md: Billing states, Plans sells) ----------

  protected readonly accountTier = computed(() => (this.isPremium() ? 'premium' : null) as 'premium' | null);
  protected readonly accountName = computed(() => (this.isPremium() ? 'Premium' : this.isVenue() ? 'Venue' : 'Free'));
  protected readonly accountLine = computed(() => {
    const free = formatBytes(plan('Free').eventBytes ?? 0);
    if (this.isPremium()) return `Every event you organise gets ${this.premiumSpace} for photos and videos and no "Made with" mark, and keeps everything while you subscribe.`;
    if (this.isVenue()) return 'Gold and Platinum passes for the events you run, half price, with your name and logo on their QR cards and albums.';
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
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** What the event's plan means today, in one line. */
  protected eventLine(e: BillingEvent): string {
    const free = formatBytes(plan('Free').eventBytes ?? 0);
    if (e.isDraft) return 'You choose its plan at the last step of setting it up.';
    if (e.trimAt) return `Back to Free on ${this.day(e.trimAt)}: about ${formatBytes(e.trimBytes ?? 0)} above ${free} will be removed. Download everything or extend.`;
    if (e.passActive && e.passUntil) return `${e.pass} pass until ${this.day(e.passUntil)}${e.keepPhotosUntil ? `, everything kept until ${this.day(e.keepPhotosUntil)}` : ''}.`;
    if (e.keepPhotosUntil && new Date(e.keepPhotosUntil) > new Date()) return `Everything kept until ${this.day(e.keepPhotosUntil)}.`;
    if (e.plan === 'Premium') return 'On your Premium.';
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
    if (e.sending.total > 0 && e.sending.used >= e.sending.total * 0.8) {
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
      if (status === 'Paid') this.load();
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

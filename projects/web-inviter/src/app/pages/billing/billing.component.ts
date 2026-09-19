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
import { mvr, planLabel, usd } from '../../shared/utils/plans';
import { BillingItem, BillingOverview } from '../../shared/utils/types/api.types';

/**
 * Billing: what the account is on, what each of its events has and can have (a pass, another year of
 * it, emails, keeping the photos), and what has been paid. Every "buy" goes through one call (billingCheckout); while online
 * payment is switched off on the server it answers "not yet", and the page sends the person to "Ask
 * us" with the right topic instead — so switching the gateway on changes nothing here.
 */
@Component({
  selector: 'app-billing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState, UiSpinner, UiText],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(UiToastService);

  protected readonly overview = signal<BillingOverview | null>(null);
  protected readonly failed = signal(false);
  /** Which button is waiting on the server: `item` or `item:campaignId`. */
  protected readonly busy = signal<string | null>(null);

  protected readonly mvr = mvr;
  protected readonly planLabel = planLabel;

  protected readonly isStudio = computed(() => {
    const a = this.overview()?.account;
    return !!a && a.tier === 'Studio' && a.active;
  });
  protected readonly isVenue = computed(() => {
    const a = this.overview()?.account;
    return !!a && a.tier === 'Venue' && a.active;
  });

  constructor() {
    this.load();
    // Back from the gateway's page: the payment is applied by its webhook, usually before this loads.
    if (this.route.snapshot.queryParamMap.get('paid')) {
      this.toast.success('Payment received. Thank you!');
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
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
    this.api.billingCheckout(item, campaignId, quantity).subscribe({
      next: (r) => {
        this.busy.set(null);
        if (r.available && r.checkoutUrl) {
          window.location.href = r.checkoutUrl;
          return;
        }
        if (r.message) this.toast.info(r.message);
        void this.router.navigate(['/inquire'], {
          queryParams: { topic: r.inquireTopic ?? 'party', ...(campaignId ? { event: campaignId } : {}) },
        });
      },
      error: () => this.busy.set(null),
    });
  }
}

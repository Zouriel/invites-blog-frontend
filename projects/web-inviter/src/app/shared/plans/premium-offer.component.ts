import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiModal, UiToastService } from '@zouriel/ui/dialog';
import { CheckoutFlow } from '../checkout/checkout-flow.service';
import { SessionStore } from '../services/session.store';
import { designerAiOn, downloadLimit } from '../utils/plans';
import { BillingItem } from '../utils/types/api.types';
import { PlanOfferCardComponent } from './plan-offer-card.component';

/** Why the offer opened: more than the limit at once (or Download all), or the AI designer. */
export type PremiumOfferReason = 'download' | 'ai';

/**
 * The Premium offer, raised where a Premium perk is asked for: Download all or an 11th photo in an album, and the AI
 * designer. It is the Plans page's Premium card (server perks, the AI designer tick, the same button), so what is
 * offered here is exactly what Plans sells. For the AI designer the tick starts on; someone already on Premium gets
 * the card's "Add the AI designer" instead (the add-on for the rest of their month). Buying goes through the same
 * review-and-pay step as everywhere, and comes back to the page it started on.
 */
@Component({
  selector: 'app-premium-offer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, PlanOfferCardComponent],
  template: `
    <ui-modal [(open)]="open" [title]="title()" size="sm">
      <p class="lead">{{ lead() }}</p>
      <app-plan-offer-card
        kind="Premium"
        [current]="onPremium()"
        [aiOn]="aiOn()"
        [busy]="buying()"
        [(withAi)]="withAi"
        (choose)="buy($event)" />
    </ui-modal>
  `,
  styles: `
    .lead { margin: 0 0 var(--ui-space-4); color: var(--ui-color-text-muted); line-height: 1.5; }
  `,
})
export class PremiumOfferComponent {
  private readonly session = inject(SessionStore);
  private readonly checkout = inject(CheckoutFlow);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  readonly open = model(false);
  readonly reason = input<PremiumOfferReason>('download');
  /** The album's own limit, when it says. */
  readonly limit = input<number | null>(null);

  protected readonly withAi = signal(false);
  protected readonly buying = signal<BillingItem | null>(null);

  protected readonly onPremium = computed(() => {
    const a = this.session.account();
    return !!a && a.subscriptionTier === 'Premium' && (!a.subscriptionEndsAt || new Date(a.subscriptionEndsAt) > new Date());
  });
  protected readonly aiOn = computed(() => designerAiOn(this.session.account()?.addOns));

  protected readonly title = computed(() =>
    this.reason() === 'ai'
      ? 'Design with the AI designer'
      : `Download more than ${this.limit() ?? downloadLimit()} at once with Premium`,
  );
  protected readonly lead = computed(() =>
    this.reason() === 'ai'
      ? this.onPremium()
        ? 'Tell it what you want and it builds and changes your template for you. Add it to your Premium.'
        : 'Tell it what you want and it builds and changes your template for you. It is an add-on to Premium.'
      : `Without Premium you can download or share up to ${this.limit() ?? downloadLimit()} at a time. Premium lets you take a whole album in one go, from any album you can see.`,
  );

  constructor() {
    // Each time it opens: the AI designer's offer starts with its tick on, the download offer without.
    effect(() => {
      if (this.open()) this.withAi.set(this.reason() === 'ai');
    });
    // The review step takes over once it is up: one dialog at a time.
    effect(() => {
      if (this.checkout.review() && this.buying()) this.open.set(false);
    });
  }

  protected buy(item: BillingItem): void {
    if (!this.session.isSignedIn()) {
      this.open.set(false);
      void this.router.navigate(['/login'], { queryParams: { next: item === 'premium-ai-monthly' ? '/pricing?ai=1' : '/pricing' } });
      return;
    }
    if (this.buying()) return;
    this.buying.set(item);
    // Back to Billing after paying, which confirms the payment with the bank and shows the plan.
    this.checkout.start({ item, returnPath: '/billing' }).subscribe({
      next: (r) => {
        this.buying.set(null);
        if (r.kind === 'redirecting') return;
        if (r.kind === 'cancelled') return;
        this.open.set(false);
        if (r.message) this.toast.info(r.message);
        void this.router.navigate(['/inquire'], { queryParams: { topic: r.inquireTopic ?? 'premium' } });
      },
      error: () => this.buying.set(null),
    });
  }
}

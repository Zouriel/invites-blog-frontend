import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiPlanCard } from '@zouriel/ui/plans';
import { addOnNote, catalog, designerAddOn, mvr, perksOf, plan, planLabel, usd } from '../utils/plans';
import { BillingItem, PlanCatalog } from '../utils/types/api.types';

/** What a subscription card can be. Studio's kind stays Venue. */
export type SubscriptionKind = 'Premium' | 'Venue';

/**
 * The one card for a monthly plan (Premium, Studio), wherever it is sold or described: the Plans page, the Premium
 * offers (Download all, the AI designer) and the review before paying. Its bullets are the server's `perks` and its
 * prices the catalog's, so every place shows the same card (owner, 2026-11-13: "the Plans page cards and the cards
 * shown when pressing Subscribe are different").
 *
 * <p>Premium carries the AI designer as a tick under its bullets: ticked, the button and the total are Premium with
 * the AI designer (premium-ai-monthly); not ticked, Premium alone (premium-monthly). `mode="show"` (the review step)
 * draws the same card without a button, the tick showing what is being bought.</p>
 */
@Component({
  selector: 'app-plan-offer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiPlanCard],
  template: `
    @if (p(); as p) {
      <ui-plan-card
        [name]="name()"
        tier="premium"
        [current]="current()"
        [highlight]="highlight()"
        [price]="price()"
        period="a month"
        [note]="note()"
        [tagline]="tagline()"
        [features]="perks()"
        [addOn]="tick() ? 'Add the ' + addOn().name : null"
        [addOnNote]="tick() ? addOnLine() : null"
        [addOnDisabled]="mode() === 'show'"
        [(addOnChecked)]="withAi">
        <!-- ngProjectAs: a control-flow block reaches a named slot only through one root element. -->
        <ng-container ngProjectAs="[plan-action]">
          @if (mode() === 'buy') {
            @if (current()) {
              @if (kind() === 'Premium' && !aiOn()) {
                <ui-button tier="premium" [block]="true" [loading]="busy() === 'designer-ai-add'" (click)="choose.emit('designer-ai-add')">
                  Add the AI designer
                </ui-button>
              } @else {
                <ui-button variant="outline" [block]="true" routerLink="/billing">Manage in Billing</ui-button>
              }
            } @else {
              <ui-button tier="premium" [block]="true" [loading]="busy() === item()" (click)="choose.emit(item())">
                {{ kind() === 'Venue' ? 'Get ' + name() : 'Subscribe' }} · {{ price() }} a month
              </ui-button>
            }
          }
        </ng-container>
        <ng-container ngProjectAs="[plan-fineprint]">
          @if (mode() === 'buy') {
            @if (current() && kind() === 'Premium' && !aiOn()) {
              <a routerLink="/billing">Manage Premium in Billing</a>
            } @else if (kind() === 'Venue') {
              Renews every month until you turn it off in Billing. When it ends, your events go back to Free like an ended
              Premium, and the people they're for can keep their photos with a Platinum pass.
            } @else {
              Renews every month on the card you pay with until you turn it off in Billing.
            }
          }
        </ng-container>
      </ui-plan-card>
    }
  `,
  styles: `:host { display: block; height: 100%; } a { color: inherit; }`,
})
export class PlanOfferCardComponent {
  /** Premium or Studio (Venue). */
  readonly kind = input.required<SubscriptionKind>();
  /** The catalog to read; the one in force when left out. */
  readonly catalog = input<PlanCatalog | null>(null);
  /** The reader is on this plan now. */
  readonly current = input(false);
  /** On Premium with the AI designer already. */
  readonly aiOn = input(false);
  /** 'buy': with its button (Plans, offers). 'show': the card alone, as on the review step. */
  readonly mode = input<'buy' | 'show'>('buy');
  readonly highlight = input<string | null>(null);
  /** Which button waits on the server. */
  readonly busy = input<BillingItem | null>(null);
  /** The AI designer tick (Premium only). */
  readonly withAi = model(false);
  /** The item its button buys. */
  readonly choose = output<BillingItem>();

  private readonly cat = computed(() => this.catalog() ?? catalog());
  protected readonly p = computed(() => this.cat().plans.find((x) => x.kind === this.kind()) ?? plan(this.kind()));
  protected readonly addOn = computed(() => designerAddOn(this.cat()));
  protected readonly addOnLine = computed(() => addOnNote(this.addOn()));
  protected readonly name = computed(() => planLabel(this.kind()));
  protected readonly perks = computed(() => perksOf(this.p()));
  protected readonly tagline = computed(() =>
    this.kind() === 'Venue' ? 'For businesses that run events: resorts, halls and planners.' : 'For people who host often.',
  );

  /** The tick shows on Premium, unless its reader is on Premium already (they add it from the button or Billing). */
  protected readonly tick = computed(
    () => this.kind() === 'Premium' && this.addOn().forKinds.includes('Premium') && !this.current(),
  );

  /** The monthly total: Premium, plus the AI designer when ticked. */
  protected readonly total = computed(() => this.p().price + (this.tick() && this.withAi() ? this.addOn().price : 0));
  protected readonly price = computed(() => mvr(this.total()));
  protected readonly note = computed(() => `about ${usd(this.total(), this.cat().mvrPerUsd).replace(/^≈\s*/, '')}`);

  /** What the button buys. */
  protected readonly item = computed<BillingItem>(() =>
    this.kind() === 'Venue' ? 'venue-monthly' : this.withAi() ? 'premium-ai-monthly' : 'premium-monthly',
  );
}

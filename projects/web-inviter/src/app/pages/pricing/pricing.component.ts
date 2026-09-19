import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { PLAN_CATALOG, formatBytes, mvr, usd, windowLine } from '../../shared/utils/plans';
import { Plan, PlanCatalog } from '../../shared/utils/types/api.types';
import { PRICING_FAQ } from './pricing-faq';

export { PRICING_FAQ } from './pricing-faq';

type Row = { label: string; value: (p: Plan) => string };

/**
 * The plans and prices, in full. Prerendered, and read from the same catalog the server enforces
 * (with the same numbers built in until it answers).
 *
 * <p>Hosts first — Free, then a pass per event — because that is nearly everyone; the two plans for
 * professionals sit below, with the add-ons between.</p>
 */
@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiAccordion, UiAccordionItem, UiBadge, UiButton, UiCard, UiText],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  private readonly api = inject(ApiService);

  protected readonly catalog = signal<PlanCatalog>(PLAN_CATALOG);
  private readonly byKind = computed(() => new Map(this.catalog().plans.map((p) => [p.kind, p])));
  /** What a host picks between, for one event. */
  protected readonly hostPlans = computed(() =>
    (['Free', 'PartyPass', 'WeddingPass'] as const).map((k) => this.byKind().get(k)).filter((p): p is Plan => !!p),
  );
  /** Plans for people who do this for a living. */
  protected readonly proPlans = computed(() =>
    (['Studio', 'Venue'] as const).map((k) => this.byKind().get(k)).filter((p): p is Plan => !!p),
  );
  /** The columns of the comparison: every plan that gives an event something. */
  protected readonly eventPlans = computed(() => [...this.hostPlans(), ...this.proPlans().filter((p) => p.kind === 'Venue')]);
  protected readonly faq = PRICING_FAQ;
  protected readonly mvr = mvr;

  protected usd(amount: number): string {
    return usd(amount, this.catalog().mvrPerUsd);
  }

  /** Who each plan is for, in one line. */
  protected readonly audience: Record<string, string> = {
    Free: 'Birthdays, dinners, get-togethers, and trying it out.',
    PartyPass: 'The big birthday, the engagement, the party that fills a hall.',
    WeddingPass: 'The wedding: the nikah, the reception and the after-party.',
    Studio: 'Invitation designers and wedding planners, for their clients.',
    Venue: 'Resorts and halls, for every event at the property.',
  };

  protected readonly rows: Row[] = [
    { label: 'Invitations, designs, guest list and replies', value: () => 'Free' },
    { label: 'Share your own link', value: () => 'Free' },
    { label: 'Photo and video space', value: (p) => `${formatBytes(p.eventBytes ?? 0)} per event` },
    { label: 'Albums per event', value: (p) => String(p.maxBuckets ?? 1) },
    {
      label: 'Days guests can add photos',
      value: (p) => ((p.maxWindowDays ?? 1) > 1 ? `Until ${p.maxWindowDays} days after it starts` : 'Day before to day after'),
    },
    { label: 'Private albums', value: (p) => (p.privateAlbums ? 'Yes' : '—') },
    {
      label: 'Invitations emailed for you',
      value: (p) =>
        p.includedInvites
          ? `${p.includedInvites} included`
          : `${mvr(this.catalog().sending.perBlock)} per ${this.catalog().sending.blockSize}`,
    },
    { label: 'QR codes for the tables, and download-all', value: () => 'Yes' },
    {
      label: 'Photos kept',
      value: (p) =>
        (p.retentionDays === null ? 'While the venue’s plan runs' : p.retentionDays >= 365 ? 'A year' : `${p.retentionDays} days after the event`)
        + ', then the wind-down below',
    },
    { label: '"Made with invites.blog" on the invitation', value: (p) => (p.branded ? 'Small, in the corner' : '—') },
  ];

  constructor() {
    // Only a catalog in the shape this page reads: an older server (or one mid-deploy) keeps the
    // built-in one rather than drawing an empty page.
    this.api.plans().subscribe({ next: (c) => c?.keepPhotos && c.plans?.length && this.catalog.set(c), error: () => {} });
  }

  protected priceLine(p: Plan): string {
    return p.price === 0 ? 'MVR 0' : `${p.from ? 'from ' : ''}${mvr(p.price)}`;
  }

  protected features(p: Plan): string[] {
    const sending = this.catalog().sending;
    switch (p.kind) {
      case 'Free':
        return [
          'Any design, unlimited guests and replies',
          'Share your link anywhere, free (emailing guests is extra)',
          `${formatBytes(p.eventBytes ?? 0)} for photos and videos, one album`,
          `Guests add photos ${windowLine(p.maxWindowDays)}`,
          `Photos kept ${p.retentionDays} days after the event`,
          'A small “Made with invites.blog” on the invitation',
        ];
      case 'PartyPass':
      case 'WeddingPass':
        return [
          `${formatBytes(p.eventBytes ?? 0)} for this event, up to ${p.maxBuckets} albums`,
          `Guests add photos ${windowLine(p.maxWindowDays)}`,
          ...(p.privateAlbums ? ['Private albums, for only some guests'] : []),
          `${p.includedInvites} invitations emailed for you`,
          `Photos kept for ${(p.retentionDays ?? 0) >= 365 ? 'a year' : `${p.retentionDays} days`}, no "Made with" mark`,
        ];
      case 'Studio':
        return [
          'Your clients’ events in one place',
          '"Designed by" you, on invitations you made for them',
          `Passes at ${this.catalog().studioDiscountPercent}% off to include in your packages`,
          `Extra invitations at ${mvr(sending.perBlock)} per ${sending.blockSize}`,
        ];
      default:
        return [
          'Albums for every event at your property',
          `${formatBytes(p.eventBytes ?? 0)} and ${p.maxBuckets} albums per event, ${formatBytes(p.accountBytes ?? 0)} in all`,
          'Your name and logo on the QR cards and albums',
          'Staff accounts to run the events',
        ];
    }
  }

  /** "or MVR 4,500 a year" under a monthly price, or the Studio price of a pass. */
  protected altLine(p: Plan): string {
    if (p.price === 0) return 'No card needed';
    if (p.yearlyPrice) return `${this.usd(p.price)} · or ${mvr(p.yearlyPrice)} a year`;
    if (p.studioPrice) return `${this.usd(p.price)} · ${mvr(p.studioPrice)} on Studio`;
    return `${this.usd(p.price)}${p.from ? ' · larger properties quoted' : ''}`;
  }
}

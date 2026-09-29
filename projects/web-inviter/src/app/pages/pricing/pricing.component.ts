import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { catalog, formatBytes, mvr, usd, windowLine, venueDiscount } from '../../shared/utils/plans';
import { Plan, PlanCatalog } from '../../shared/utils/types/api.types';
import { pricingFaq } from './pricing-faq';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { CardBrandsComponent } from '../../shared/brand/card-brands.component';

export { pricingFaq } from './pricing-faq';

type Row = { label: string; value: (p: Plan) => string };

/**
 * The plans and prices, in full. Prerendered, and read from the same catalog the server enforces
 * (with the same numbers built in until it answers).
 *
 * <p>Hosts first — Free, then a pass per event — because that is nearly everyone; the two monthly
 * subscriptions (Premium, Venue) sit below, with the add-ons between.</p>
 */
@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, CardBrandsComponent, RouterLink, UiAccordion, UiAccordionItem, UiBadge, UiButton, UiCard, UiText],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  private readonly api = inject(ApiService);

  protected readonly catalog = signal<PlanCatalog>(catalog());
  private readonly byKind = computed(() => new Map(this.catalog().plans.map((p) => [p.kind, p])));
  /** What a host picks between, for one event. */
  protected readonly hostPlans = computed(() =>
    (['Free', 'PartyPass', 'WeddingPass'] as const).map((k) => this.byKind().get(k)).filter((p): p is Plan => !!p),
  );
  /** The monthly subscriptions. */
  protected readonly proPlans = computed(() =>
    (['Premium', 'Venue'] as const).map((k) => this.byKind().get(k)).filter((p): p is Plan => !!p),
  );
  /** The columns of the comparison: every plan that gives an event something. A venue's events are on passes. */
  protected readonly eventPlans = computed(() =>
    (['Free', 'PartyPass', 'WeddingPass', 'Premium'] as const).map((k) => this.byKind().get(k)).filter((p): p is Plan => !!p),
  );
  protected readonly faq = pricingFaq();
  protected readonly mvr = mvr;

  protected usd(amount: number): string {
    return usd(amount, this.catalog().mvrPerUsd);
  }

  /** Who each plan is for, in one line. */
  protected readonly audience: Record<string, string> = {
    Free: 'Birthdays, dinners, get-togethers, and trying it out.',
    PartyPass: 'The big birthday, the engagement, the party that fills a hall.',
    WeddingPass: 'The wedding: the nikah, the reception and the after-party.',
    Premium: 'People who host often, and want every event’s photos kept.',
    Venue: 'Resorts and halls, for the events they run.',
  };

  protected readonly rows: Row[] = [
    { label: 'Invitations, designs, guest list and replies', value: () => 'Free' },
    { label: 'Share your own link', value: () => 'Free' },
    { label: 'Save the dates, with add-to-calendar', value: () => 'Free' },
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
        (p.retentionDays === null ? 'While you subscribe' : p.retentionDays >= 365 ? 'A year' : `${p.retentionDays} days after the event`)
        + ', then the wind-down below',
    },
    { label: 'Another year, without invitations', value: (p) => (p.extensionPrice ? mvr(p.extensionPrice) : '—') },
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
    switch (p.kind) {
      case 'Free':
        return [
          'Any design, unlimited guests and replies',
          'Save the dates too, with add-to-calendar',
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
          ...(p.extensionPrice ? [`Another year after that: ${mvr(p.extensionPrice)} (no invitations)`] : []),
        ];
      case 'Premium':
        return [
          `${formatBytes(p.eventBytes ?? 0)} for photos and videos on every event you organise`,
          'Photos kept for as long as you subscribe',
          'No “Made with invites.blog” mark',
          'A Party or Wedding pass still adds more to any one event',
          '“Designed by” you, on invitations made from your designs',
        ];
      default:
        return [
          `Party and Wedding passes for your events, ${venueDiscount()}% off, renewals too`,
          'You charge your clients yourself, at your own price',
          'Your name and logo on the QR cards and albums',
          'Staff accounts to run the events',
        ];
    }
  }

  /** The price in dollars, roughly, under the rufiyaa. */
  protected altLine(p: Plan): string {
    if (p.price === 0) return 'No card needed';
    return `${this.usd(p.price)}${p.from ? ' · larger properties quoted' : ''}`;
  }
}

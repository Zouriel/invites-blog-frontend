import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { PLAN_CATALOG, formatBytes, rufiyaa } from '../../shared/utils/plans';
import { Plan, PlanCatalog } from '../../shared/utils/types/api.types';

type Row = { label: string; value: (p: Plan) => string };

/** FAQ shown on the page and given to search engines as structured data (see app.routes.ts). */
export const PRICING_FAQ = [
  {
    q: 'Is it really free to make an invitation?',
    a: 'Yes. Designs, your wording, the guest list, replies and sharing your own links never cost anything. You only pay for more photo space, or when invites.blog sends the invitations for you.',
  },
  {
    q: 'What does sending cost?',
    a: 'Sending to your first 50 guests costs $5, then $1 for every 10 more. On Premium, extra guests are $1 for every 20. An event pass includes sending to the first 50.',
  },
  {
    q: 'Which plan should I pick for a wedding?',
    a: 'Usually the event pass. It is a one-off $19 that gives that one event 50 GB, up to three buckets, a longer upload window and sending to 50 guests.',
  },
  {
    q: 'Can I choose how big each bucket is?',
    a: 'Yes, on Basic and Premium. Your account gets 20 GB or 200 GB, and you decide how much each event gets: up to 10 GB per event on Basic and 50 GB on Premium, as long as the total fits. Your account page shows how much is left. An event pass is fixed at 50 GB for its one event.',
  },
  {
    q: 'What happens to the photos when a plan ends?',
    a: 'Nothing is deleted straight away. Uploads stop, guests can still look for 30 days, then only you can for another 60 days, and the photos are removed 90 days after the plan ended. We email you before each step, and renewing restores everything.',
  },
  {
    q: 'How do I pay?',
    a: 'Online payments are being set up. Until then, ask us and we will switch your plan on.',
  },
];

/**
 * The plans and prices, in full. Prerendered, and read from the same catalog the server enforces
 * (with the same numbers built in until it answers).
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
  protected readonly plans = computed(() => this.catalog().plans);
  protected readonly faq = PRICING_FAQ;

  protected readonly rufiyaa = rufiyaa;

  /** Who each plan is for, in one line. */
  protected readonly audience: Record<string, string> = {
    Free: 'Anyone trying it, and small get-togethers.',
    Basic: 'Families and friends who hold a few events a year.',
    EventPass: 'The wedding, the big birthday. Premium for one event.',
    Premium: 'Planners, venues and people who host all year.',
  };

  protected readonly rows: Row[] = [
    { label: 'Invitations, designs, guest list and replies', value: () => 'Free' },
    { label: 'Share your own links', value: () => 'Free' },
    {
      label: 'invites.blog sends them',
      value: (p) =>
        p.includesFirstSend
          ? 'First 50 included, then $1 per 10'
          : `$5 for 50, then $1 per ${p.invitesPerDollar}`,
    },
    {
      label: 'Photo and video space',
      value: (p) =>
        p.allocatable
          ? `${formatBytes(p.accountBytes ?? 0)} to share out, up to ${p.kind === 'Premium' ? '50 GB' : '10 GB'} per event`
          : `${formatBytes(p.eventBytes)} per event`,
    },
    {
      label: 'Space across your account',
      value: (p) => (p.accountBytes ? formatBytes(p.accountBytes) : p.kind === 'EventPass' ? 'That event only' : '—'),
    },
    { label: 'Choose each bucket\'s size', value: (p) => (p.allocatable ? 'Yes' : '—') },
    { label: 'Buckets per event', value: (p) => (p.maxBuckets > 1 ? `Up to ${p.maxBuckets}` : '1') },
    {
      label: 'Upload window',
      value: (p) => (p.maxWindowDays > 1 ? `Up to ${p.maxWindowDays} days` : 'Day before to day after'),
    },
    { label: 'Printed QR codes and download-all', value: () => 'Yes' },
    {
      label: 'Photos kept',
      value: (p) =>
        p.kind === 'Free' ? '90 days after the event' : p.kind === 'EventPass' ? '6 months after the event' : 'While subscribed',
    },
  ];

  constructor() {
    this.api.plans().subscribe({ next: (c) => c && this.catalog.set(c), error: () => {} });
  }

  protected priceLine(p: Plan): string {
    return p.price === 0 ? '$0' : `$${p.price}`;
  }

  protected features(p: Plan): string[] {
    switch (p.kind) {
      case 'Free':
        return ['Unlimited invitations and guests', 'Share links yourself, RSVPs', `Camera with ${formatBytes(p.eventBytes)} per event`, 'Photos kept 90 days after the event'];
      case 'Basic':
        return [`${formatBytes(p.accountBytes ?? 0)} to share out between your events`, 'Choose each bucket\'s size, up to 10 GB per event', 'Photos kept while subscribed', 'Download everything at once'];
      case 'EventPass':
        return [`Up to ${formatBytes(p.eventBytes)} for that event`, `Up to ${p.maxBuckets} buckets`, `Upload window up to ${p.maxWindowDays} days`, 'Sending to the first 50 guests included', 'Kept 6 months after the event'];
      default:
        return [`${formatBytes(p.accountBytes ?? 0)} to share out between your events`, 'Choose each bucket\'s size, up to 50 GB per event', `Up to ${p.maxBuckets} buckets per event`, `Upload window up to ${p.maxWindowDays} days`, 'Extra invitations at half price'];
    }
  }
}

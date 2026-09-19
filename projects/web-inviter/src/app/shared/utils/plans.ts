import { Plan, PlanCatalog } from './types/api.types';

/** Megabytes until there is a gigabyte worth saying, and terabytes past a thousand gigabytes. */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1000) return `${Math.round((gb / 1024) * 10) / 10} TB`;
  if (gb >= 1) return `${Number.isInteger(Math.round(gb * 10) / 10) ? Math.round(gb) : gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** What each plan is called on screen. */
export function planLabel(kind: string): string {
  switch (kind) {
    case 'PartyPass':
      return 'Party pass';
    case 'WeddingPass':
      return 'Wedding pass';
    default:
      return kind;
  }
}

/** Rufiyaa to the dollar, for the approximate dollar prices shown alongside. The server's catalogue says the same. */
export const MVR_PER_USD = 15.42;

/** A price in rufiyaa: "MVR 699". */
export function mvr(amount: number): string {
  return `MVR ${amount.toLocaleString('en-US')}`;
}

/** The same price in dollars, roughly: "≈ $45". */
export function usd(amount: number, rate = MVR_PER_USD): string {
  return `≈ $${Math.round(amount / rate).toLocaleString('en-US')}`;
}

const GB = 1024 ** 3;

/**
 * The same catalog the server serves at /api/plans (PlanCatalog.Describe), used until that answers
 * — and while the pricing page is prerendered. The server is the one that enforces every limit, so a
 * change there must be made here too.
 */
export const PLAN_CATALOG: PlanCatalog = {
  currency: 'MVR',
  mvrPerUsd: MVR_PER_USD,
  plans: [
    { kind: 'Free', name: 'Free', price: 0, billing: 'every event', yearlyPrice: null, studioPrice: null,
      eventBytes: 1 * GB, accountBytes: null, maxBuckets: 1, maxWindowDays: 1, retentionDays: 90,
      includedInvites: 0, privateAlbums: false, branded: true, from: false },
    { kind: 'PartyPass', name: 'Party pass', price: 199, billing: 'per event', yearlyPrice: null, studioPrice: 139,
      eventBytes: 10 * GB, accountBytes: null, maxBuckets: 2, maxWindowDays: 3, retentionDays: 365,
      includedInvites: 100, privateAlbums: false, branded: false, from: false },
    { kind: 'WeddingPass', name: 'Wedding pass', price: 699, billing: 'per event', yearlyPrice: null, studioPrice: 489,
      eventBytes: 100 * GB, accountBytes: null, maxBuckets: 5, maxWindowDays: 5, retentionDays: 365,
      includedInvites: 500, privateAlbums: true, branded: false, from: false },
    { kind: 'Studio', name: 'Studio', price: 450, billing: 'per month', yearlyPrice: 4500, studioPrice: null,
      eventBytes: null, accountBytes: null, maxBuckets: null, maxWindowDays: null, retentionDays: null,
      includedInvites: 0, privateAlbums: false, branded: false, from: false },
    { kind: 'Venue', name: 'Venue', price: 2300, billing: 'per month', yearlyPrice: null, studioPrice: null,
      eventBytes: 100 * GB, accountBytes: 1024 * GB, maxBuckets: 5, maxWindowDays: 5, retentionDays: null,
      includedInvites: 0, privateAlbums: true, branded: false, from: true },
  ],
  keepPhotos: { price: 150, months: 12 },
  sending: { perBlock: 50, blockSize: 100 },
  lapse: { reminderDay: 23, organiserOnlyDay: 30, finalNoticeDay: 83, deleteDay: 90 },
  studioDiscountPercent: 30,
};

/** One plan from the built-in catalog, for the sentences that describe it. */
export function plan(kind: Plan['kind']): Plan {
  return PLAN_CATALOG.plans.find((p) => p.kind === kind)!;
}

/** "1 GB free, 10 GB with a Party pass and 100 GB with a Wedding pass": how much an event's albums hold. */
export function spaceLadder(): string {
  const [free, party, wedding] = (['Free', 'PartyPass', 'WeddingPass'] as const).map((k) => formatBytes(plan(k).eventBytes!));
  return `${free} free, ${party} with a Party pass and ${wedding} with a Wedding pass`;
}

/**
 * When guests can add photos. Every album opens the day before its event; on Free it closes when the
 * day after ends, and a pass keeps it open for that many days after the event starts (EventDayWindow).
 */
export function windowLine(days: number | null | undefined): string {
  return (days ?? 1) > 1 ? `until ${days} days after it starts` : 'from the day before to the day after';
}

/** "10 GB, 2 albums, photos until 3 days after, 100 invitations sent": what a pass gives one event. */
export function passSummary(p: Plan): string {
  const parts = [
    formatBytes(p.eventBytes ?? 0),
    `${p.maxBuckets} albums`,
    `photos until ${p.maxWindowDays} days after`,
    p.privateAlbums ? 'private albums' : null,
    p.includedInvites ? `${p.includedInvites} invitations sent` : null,
  ];
  return parts.filter(Boolean).join(', ');
}

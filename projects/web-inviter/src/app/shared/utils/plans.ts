import type { UiBadgeTier } from '@zouriel/ui';
import { Account, AccountAddOn, Plan, PlanAddOn, PlanCatalog } from './types/api.types';

/** Megabytes until there is a gigabyte worth saying, and terabytes past a thousand gigabytes. */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1000) return `${Math.round((gb / 1024) * 10) / 10} TB`;
  if (gb >= 1) return `${Number.isInteger(Math.round(gb * 10) / 10) ? Math.round(gb) : gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** What each plan is called on screen. The one place a plan kind becomes its shown name. */
export function planLabel(kind: string): string {
  switch (kind) {
    case 'GoldPass':
      return 'Gold pass';
    case 'PlatinumPass':
      return 'Platinum pass';
    // "Premium" since 2026-11-13 (the server's name too); it was "Premium pass".
    case 'Premium':
      return 'Premium';
    // The server's kind stays "Venue" (API, billing items, stores); people see Studio (owner, 2026-11-12).
    case 'Venue':
      return 'Studio';
    // Studio without the AI designer (2026-11-13).
    case 'Photographer':
      return 'Photographer';
    default:
      return kind;
  }
}

/**
 * The metal a plan's pill wears: a Gold pass in gold, a Platinum pass in platinum, anything else on
 * its tone. Takes a plan kind (GoldPass) or an event's pass (Gold). Every pill showing a plan uses this.
 */
export function planTier(kind: string | null | undefined): UiBadgeTier | null {
  switch (kind) {
    case 'GoldPass':
    case 'Gold':
      return 'gold';
    case 'PlatinumPass':
    case 'Platinum':
      return 'platinum';
    case 'Premium':
      return 'premium';
    default:
      return null;
  }
}

/** Rufiyaa to the dollar, for the approximate dollar prices shown alongside. The server's catalogue says the same. */
export const MVR_PER_USD = 15.42;

/** A price in rufiyaa: "MVR 699". */
export function mvr(amount: number): string {
  return `MVR ${amount.toLocaleString('en-US')}`;
}

/** The same price in dollars, roughly: "≈ $45", at the rate the price book is set to. */
export function usd(amount: number, rate = live.mvrPerUsd || MVR_PER_USD): string {
  return `≈ $${Math.round(amount / rate).toLocaleString('en-US')}`;
}

const GB = 1024 ** 3;

/**
 * The catalog in code: the server's defaults (PlanCatalog + Prices.Defaults), used until /api/plans
 * answers and whenever it can't. Prices an admin changes arrive through {@link setCatalog}; limits
 * are the server's to enforce, so a change to one must be made here too (plans.spec.ts pins them).
 */
export const PLAN_CATALOG: PlanCatalog = {
  currency: 'MVR',
  mvrPerUsd: MVR_PER_USD,
  plans: [
    { kind: 'Free', name: 'Free', price: 0, billing: 'every event',
      eventBytes: 300 * 1024 ** 2, maxBuckets: 1, maxWindowDays: 1, retentionDays: null,
      includedInvites: 0, privateAlbums: false, branded: true, from: false },
    { kind: 'GoldPass', name: 'Gold pass', price: 199, billing: 'per event',
      eventBytes: 5 * GB, maxBuckets: 2, maxWindowDays: 3, retentionDays: 365,
      includedInvites: 100, privateAlbums: false, branded: false, from: false, extensionPrice: 99 },
    { kind: 'PlatinumPass', name: 'Platinum pass', price: 499, billing: 'per event',
      eventBytes: 10 * GB, maxBuckets: 5, maxWindowDays: 5, retentionDays: 365,
      includedInvites: 500, privateAlbums: true, branded: false, from: false, extensionPrice: 349 },
    // A monthly subscription (2026-11-13: MVR 77, everything but the AI designer, which is an add-on): every event its
    // subscriber organises gets 2 GB and no mark, kept while it lasts, face grouping and Download all.
    { kind: 'Premium', name: 'Premium', price: 77, billing: 'per month',
      eventBytes: 2 * GB, maxBuckets: 1, maxWindowDays: 1, retentionDays: null,
      includedInvites: 0, privateAlbums: false, branded: false, from: false, monthlyEmails: 100 },
    // Photographer (2026-11-13): MVR 540 a month, for photographers: 10 GB events, a portfolio, 500 emails a month.
    { kind: 'Photographer', name: 'Photographer', price: 540, billing: 'per month',
      eventBytes: 10 * GB, maxBuckets: 1, maxWindowDays: 1, retentionDays: null,
      includedInvites: 0, privateAlbums: false, branded: false, from: false, monthlyEmails: 500 },
    // Studio (kind Venue): a monthly subscription for businesses that run events. Every event its
    // subscriber organises gets 10 GB, no mark and face grouping, kept while it lasts, under their name.
    { kind: 'Venue', name: 'Studio', price: 775, billing: 'per month',
      eventBytes: 10 * GB, maxBuckets: 1, maxWindowDays: 1, retentionDays: null,
      includedInvites: 0, privateAlbums: false, branded: false, from: false, monthlyEmails: 500 },
  ],
  keepPhotos: { price: 150, months: 12 },
  sending: { perBlock: 50, blockSize: 100 },
  lapse: { reminderDay: 23, organiserOnlyDay: 30, finalNoticeDay: 83, deleteDay: 90 },
  venueDiscountPercent: 0,
  addOns: [{ key: 'designer-ai', name: 'AI designer', price: 77, billing: 'per month', usd: 5, forKinds: ['Premium'] }],
  downloadLimit: 10,
};

/** The AI designer add-on's key, on the catalog and on the account. */
export const DESIGNER_AI = 'designer-ai';

/** How many photos anyone may download or share at once without Download all (docs/PRICING-2026-11.md §2). */
export const SELECT_LIMIT = 10;

/** The limit in force: the server's, else {@link SELECT_LIMIT}. */
export function downloadLimit(): number {
  return live.downloadLimit ?? SELECT_LIMIT;
}

/** The AI designer add-on as the catalog in force sells it (the code default until the server says). */
export function designerAddOn(c: PlanCatalog = live): PlanAddOn {
  return c.addOns?.find((a) => a.key === DESIGNER_AI) ?? PLAN_CATALOG.addOns!.find((a) => a.key === DESIGNER_AI)!;
}

/** "+MVR 77 a month, about $5": the add-on's line under the tick. */
export function addOnNote(a: PlanAddOn): string {
  return `+${mvr(a.price)} a month, about $${a.usd}`;
}

/** Whether the account's AI designer add-on is on now. */
export function designerAiOn(addOns: readonly AccountAddOn[] | null | undefined): boolean {
  return !!addOns?.find((x) => x.key === DESIGNER_AI)?.active;
}

/** The account's add-on entry, if it ever had one. */
export function designerAiOf(addOns: readonly AccountAddOn[] | null | undefined): AccountAddOn | null {
  return addOns?.find((x) => x.key === DESIGNER_AI) ?? null;
}

/**
 * Whether this account may take more than {@link SELECT_LIMIT} at once (and use Download all) everywhere: the server
 * says (canDownloadAll); an older server that doesn't is read from the plan (Premium or Studio, active).
 */
export function accountDownloadsAll(a: Account | null | undefined): boolean {
  if (!a) return false;
  if (typeof a.canDownloadAll === 'boolean') return a.canDownloadAll;
  const on = a.subscriptionTier === 'Premium' || a.subscriptionTier === 'Venue' || a.subscriptionTier === 'Photographer';
  return on && (!a.subscriptionEndsAt || new Date(a.subscriptionEndsAt) > new Date());
}

/** The account plans there are, as people see them: Premium with the add-on is a plan of its own on screen. */
export type AccountPlanKey = 'Free' | 'Premium' | 'PremiumAi' | 'Photographer' | 'Venue';

/** An account's plan in force, with its shown name and one sentence on what it gives. */
export type AccountPlan = { key: AccountPlanKey; name: string; line: string; tier: 'premium' | null };

/**
 * The one place an account's tier becomes "the plan you're on" (UI audit 2026-11-13: Plans told a Photographer
 * "You're on Free" and gave Studio and Premium Free's description). Reads the session's account
 * (subscriptionTier/subscriptionEndsAt) or Billing's (tier/endsAt/active); a plan whose end has passed is Free.
 */
export function accountPlan(
  a:
    | { subscriptionTier?: string; subscriptionEndsAt?: string | null; tier?: string; endsAt?: string | null; active?: boolean; addOns?: readonly AccountAddOn[] | null }
    | null
    | undefined,
  now = Date.now(),
): AccountPlan {
  const tier = a?.tier ?? a?.subscriptionTier ?? 'None';
  const ends = a?.endsAt ?? a?.subscriptionEndsAt ?? null;
  const on = !!a && tier !== 'None' && a.active !== false && (!ends || Date.parse(ends) > now);
  const space = (k: Plan['kind']) => formatBytes(plan(k).eventBytes ?? 0);
  const everywhere = 'Face grouping, and Download all anywhere you see photos.';
  if (on && tier === 'Premium') {
    const ai = designerAiOn(a?.addOns);
    return {
      key: ai ? 'PremiumAi' : 'Premium',
      name: ai ? 'Premium + AI designer' : 'Premium',
      tier: 'premium',
      line:
        `${space('Premium')} for photos and videos on every event you organise, no “Made with” mark, everything kept while you subscribe. ${everywhere}` +
        (ai ? ' The AI designer builds and changes your designs with you.' : ''),
    };
  }
  if (on && tier === 'Photographer')
    return {
      key: 'Photographer',
      name: planLabel('Photographer'),
      tier: 'premium',
      line: `Your portfolio at invites.blog/@you, and ${space('Photographer')} on every event you organise, under your name, with no “Made with” mark, kept while you subscribe. ${everywhere}`,
    };
  if (on && tier === 'Venue')
    return {
      key: 'Venue',
      name: planLabel('Venue'),
      tier: 'premium',
      line: `${space('Venue')} on every event you organise, under your name, with no “Made with” mark, kept while you subscribe. Your portfolio, the AI designer, face grouping, and Download all anywhere you see photos.`,
    };
  return {
    key: 'Free',
    name: 'Free',
    tier: null,
    line: `${space('Free')} per event, one album, the day before to the day after, kept forever. Download or share up to ${downloadLimit()} at a time. A small “Made with invites.blog”.`,
  };
}

/**
 * A plan card's bullets: the server's (`perks`), so the website and the apps show one list; written here from the
 * catalog's numbers only when an older server sends none.
 */
/** "500 emailed invitations a month, across your events": a subscription's monthly emails, as the server words it. */
export function monthlyEmailsLine(p: Plan): string | null {
  return p.monthlyEmails ? `${p.monthlyEmails.toLocaleString('en-US')} emailed invitations a month, across your events` : null;
}

export function perksOf(p: Plan | null | undefined): string[] {
  if (!p) return [];
  if (p.perks?.length) return p.perks;
  const free = formatBytes(plan('Free').eventBytes ?? 0);
  const space = formatBytes(p.eventBytes ?? 0);
  switch (p.kind) {
    case 'GoldPass':
      return [
        `${space} for photos and videos, ${p.maxBuckets} albums`,
        `Guests add photos ${windowLine(p.maxWindowDays)}`,
        `${p.includedInvites} invitations emailed for you`,
        'No “Made with invites.blog” mark',
        'Face grouping and Download all on its albums',
        `Everything kept for a year, then ${free} forever`,
      ];
    case 'PlatinumPass':
      return [
        'Everything in Gold, plus:',
        `${space}, up to ${p.maxBuckets} albums (nikah, reception, after-party)`,
        `Guests add photos ${windowLine(p.maxWindowDays)}`,
        'Private albums, for only some guests',
        `${p.includedInvites} invitations emailed for you`,
      ];
    case 'Premium':
      return [
        `${space} for photos and videos on every event you organise`,
        ...[monthlyEmailsLine(p)].filter((l): l is string => !!l),
        'No “Made with invites.blog” mark on any of them',
        `Everything kept while you subscribe, then ${free} each forever`,
        'Face grouping on your events',
        'Download all, and download or share more than 10 at once, anywhere you see photos',
        'A Gold or Platinum pass still adds more to any one event',
      ];
    case 'Venue':
      return [
        `${space} on every event you organise`,
        ...[monthlyEmailsLine(p)].filter((l): l is string => !!l),
        'No “Made with invites.blog” mark',
        'Face grouping, and Download all anywhere you see photos',
        'The AI designer included',
        'Photos kept while you’re on Studio',
        'Your picture and name on its albums, QR cards and posts',
      ];
    case 'Photographer':
      return [
        `${space} on every event you organise`,
        'Your own portfolio page at invites.blog/@you',
        ...[monthlyEmailsLine(p)].filter((l): l is string => !!l),
        'No “Made with invites.blog” mark',
        'Face grouping, and Download all anywhere you see photos',
        'Photos kept while you’re on Photographer',
        'Your picture and name on its albums, QR cards and posts',
      ];
    default:
      return [];
  }
}

/**
 * When a pass (or Premium) ends (owner, 2026-11-03): the event goes back to Free. Free events are
 * kept for good; if it holds more than Free's space, the organiser is warned at once (at least
 * `noticeDays` before), `reminderDaysBefore` and `finalDaysBefore` the cut, by email and push, and
 * on the day only what is above Free's space is removed. The server's MediaRetentionService.
 */
export const BACK_TO_FREE = { noticeDays: 30, reminderDaysBefore: 7, finalDaysBefore: 1 } as const;

/**
 * The catalog in force: the server's, once the app has loaded it at start (app.config.ts), else the
 * one in code. Everything that states a price reads it through here or {@link plan}, so a price an
 * admin changes shows everywhere without a release.
 */
let live: PlanCatalog = PLAN_CATALOG;

export function catalog(): PlanCatalog {
  return live;
}

/** Adopts the server's catalog, if it has the shape this app reads; an older or broken one is ignored. */
export function setCatalog(c: PlanCatalog | null | undefined): void {
  if (!c?.plans?.length || !c.keepPhotos || !c.sending || !c.lapse) return;
  if (!PLAN_CATALOG.plans.every((p) => c.plans.some((q) => q.kind === p.kind))) return;
  live = c;
}

/** One plan from the catalog in force, for the sentences that describe it. */
export function plan(kind: Plan['kind']): Plan {
  return live.plans.find((p) => p.kind === kind) ?? PLAN_CATALOG.plans.find((p) => p.kind === kind)!;
}

/** "300 MB free, 5 GB with a Gold pass and 10 GB with a Platinum pass": how much an event's albums hold. */
export function spaceLadder(): string {
  const [free, gold, platinum] = (['Free', 'GoldPass', 'PlatinumPass'] as const).map((k) => formatBytes(plan(k).eventBytes!));
  return `${free} free, ${gold} with a Gold pass and ${platinum} with a Platinum pass`;
}

/**
 * When guests can add photos. Every album opens the day before its event; on Free it closes when the
 * day after ends, and a pass keeps it open for that many days after the event starts (EventDayWindow).
 */
export function windowLine(days: number | null | undefined): string {
  return (days ?? 1) > 1 ? `until ${days} days after it starts` : 'from the day before to the day after';
}

/** "5 GB, 2 albums, photos until 3 days after, 100 invitations sent": what a pass gives one event. */
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

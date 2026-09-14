import { PlanCatalog, PlanKind } from './types/api.types';

/** Megabytes until there is a gigabyte worth saying. */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Number.isInteger(Math.round(gb * 10) / 10) ? Math.round(gb) : gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export function planLabel(kind: PlanKind | string): string {
  return kind === 'EventPass' ? 'Event pass' : kind;
}

/** Rufiyaa to the dollar, for the approximate local prices shown next to US dollars. */
export const MVR_PER_USD = 15.42;

export function rufiyaa(usd: number): string {
  return `≈ MVR ${Math.round(usd * MVR_PER_USD).toLocaleString('en-US')}`;
}

/**
 * The same catalog the server serves at /api/plans, used until that answers (or if it can't, while
 * the pricing page is prerendered). The server is the one that enforces every limit.
 */
export const PLAN_CATALOG: PlanCatalog = {
  currency: 'USD',
  plans: [
    { kind: 'Free', name: 'Free', price: 0, billing: 'Every event', yearlyPrice: null, eventBytes: 500 * 1024 ** 2,
      accountBytes: null, maxBuckets: 1, maxWindowDays: 1, retentionDays: 90, includesFirstSend: false, invitesPerDollar: 10 },
    { kind: 'Basic', name: 'Basic', price: 12, billing: 'per year', yearlyPrice: null, eventBytes: 2 * 1024 ** 3,
      accountBytes: 20 * 1024 ** 3, maxBuckets: 1, maxWindowDays: 1, retentionDays: null, includesFirstSend: false, invitesPerDollar: 10 },
    { kind: 'EventPass', name: 'Event pass', price: 19, billing: 'once, for one event', yearlyPrice: null,
      eventBytes: 50 * 1024 ** 3, accountBytes: null, maxBuckets: 3, maxWindowDays: 5, retentionDays: 180,
      includesFirstSend: true, invitesPerDollar: 10 },
    { kind: 'Premium', name: 'Premium', price: 9, billing: 'per month', yearlyPrice: 79, eventBytes: 50 * 1024 ** 3,
      accountBytes: 200 * 1024 ** 3, maxBuckets: 3, maxWindowDays: 5, retentionDays: null, includesFirstSend: false, invitesPerDollar: 20 },
  ],
  sending: { minimum: 5, includedInvites: 50, perBlock: 1, blockSize: 10, premiumBlockSize: 20 },
  lapse: { reminderDay: 23, organiserOnlyDay: 30, finalNoticeDay: 83, deleteDay: 90 },
};

import { UiStatus } from '@zouriel/ui';
import { formatBytes, mvr, planTier } from '../utils/plans';
import { BillingEvent, BillingItem, MediaBucket } from '../utils/types/api.types';

/**
 * What the event dashboard's plan card says and offers, worked out in one place (docs/PLANS-UX.md,
 * "the dashboard's pass card"). Same rules as Plans and Billing: say what the event has in plain words,
 * warn in time before anything is removed (free albums are kept forever; an ended pass goes back to
 * Free and only what is above Free's space is removed, after warnings), and offer only the actions
 * that mean something now, each in its tier's colour.
 */
export type PlanAction = {
  label: string;
  item: BillingItem;
  /** The metal of the button; null is a plain outline button. */
  tier: 'gold' | 'platinum' | 'premium' | null;
};

export type PlanStatus = {
  name: string;
  tier: 'gold' | 'platinum' | 'premium' | null;
  /** One line: what the plan gives this event now, and for how long. */
  line: string;
  /** "120 MB of 300 MB used", event-wide; null before the albums have loaded. */
  space: string | null;
  percent: number;
  meterTone: UiStatus;
  /** Almost full / full, in words; null otherwise. */
  spaceNote: string | null;
  /** The warning that matters most now (pass ending, back to Free and a cut coming). */
  alert: { tone: 'warning' | 'info'; heading: string; text: string } | null;
  /** The venue price, said once, when the event is at a venue. */
  venueNote: string | null;
  actions: PlanAction[];
};

const DAY = 864e5;

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function planStatus(
  e: BillingEvent, albums: MediaBucket[], keepPrice: number, now = Date.now(), freeBytes = 300 * 1024 ** 2,
): PlanStatus {
  const free = formatBytes(freeBytes);
  const passName = e.pass === 'Platinum' ? 'Platinum pass' : 'Gold pass';
  const passTier = planTier(e.pass) as 'gold' | 'platinum' | null;
  const premium = !e.passActive && e.plan === 'Premium';
  const ends = e.passUntil ? Date.parse(e.passUntil) : null;
  const endingSoon = e.passActive && ends !== null && ends - now < 30 * DAY;
  const ended = e.pass !== 'None' && !e.passActive;
  const kept = e.keepPhotosUntil && Date.parse(e.keepPhotosUntil) > now ? e.keepPhotosUntil : null;

  // The space is the event's, shared by its albums: every album reports the same event figures.
  const a = albums[0];
  const used = a ? (a.eventUsedBytes ?? a.usedBytes) : 0;
  const capacity = a ? a.capacityBytes : 0;
  const percent = a ? Math.min(100, capacity > 0 ? Math.round((used * 100) / capacity) : used > 0 ? 100 : 0) : 0;

  let name = 'Free';
  let tier: PlanStatus['tier'] = null;
  let line = `Free: up to ${free} of photos and videos, kept forever.`;
  if (e.passActive) {
    name = passName;
    tier = passTier;
    line = `${passName} until ${day(e.passUntil!)}: everything is kept until then, then up to ${free} forever.`;
  } else if (premium) {
    name = 'Premium pass';
    tier = 'premium';
    line = 'On your Premium pass: more space for this event and no mark, everything kept while you subscribe.';
  } else if (ended) {
    line = kept
      ? `Its ${passName} has ended. Everything is kept until ${day(kept)}, then up to ${free} forever.`
      : `Its ${passName} has ended, so it is back on Free: up to ${free} is kept forever.`;
  }
  if (e.kind === 'saveTheDate') line = e.passActive ? `${passName} until ${day(e.passUntil!)}.` : 'Free.';

  // The warning, in time to back up (retention rule, 2026-11-03): the cut's date and size first.
  let alert: PlanStatus['alert'] = null;
  if (e.trimAt) {
    alert = {
      tone: 'warning',
      heading: `This event goes back to Free on ${day(e.trimAt)}`,
      text: `About ${formatBytes(e.trimBytes ?? 0)} above ${free} will be removed then. Download everything from the album, or extend to keep it all. The cover photos and the earliest uploads are kept.`,
    };
  } else if (endingSoon) {
    alert = {
      tone: 'warning',
      heading: `Your ${passName} ends on ${day(e.passUntil!)}`,
      text: `After that the event goes back to Free: up to ${free} is kept forever, and we'll warn you before anything above it is removed. Extend to keep everything.`,
    };
  }

  let spaceNote: string | null = null;
  if (a && e.kind !== 'saveTheDate') {
    if (percent >= 100) spaceNote = 'Full: guests can’t add any more photos or videos.';
    else if (percent >= 90) spaceNote = 'Almost full: once it is, guests can’t add more.';
    if (spaceNote && e.passActive && e.pass === 'Platinum') spaceNote += ' This is the largest pass; removing photos makes room.';
  }

  const actions: PlanAction[] = [];
  if (e.kind !== 'saveTheDate' || !e.passActive) {
    // The year more, first, when the pass is ending or has ended: it keeps everything.
    if (endingSoon || ended) {
      const price = e.pass === 'Platinum' ? e.offer.platinumExtension : e.offer.goldExtension;
      actions.push({ label: `Extend a year · ${mvr(price)}`, item: e.pass === 'Platinum' ? 'platinum-extension' : 'gold-extension', tier: passTier });
    }
    if (ended && e.kind !== 'saveTheDate' && !kept) {
      actions.push({ label: `Keep everything a year · ${mvr(keepPrice)}`, item: 'keep-photos', tier: null });
    }
    if (!e.passActive && !ended) {
      actions.push({ label: `Get Gold · ${mvr(e.offer.goldPass)}`, item: 'gold-pass', tier: 'gold' });
      actions.push({ label: `Get Platinum · ${mvr(e.offer.platinumPass)}`, item: 'platinum-pass', tier: 'platinum' });
    } else if (e.passActive && e.pass === 'Gold') {
      actions.push({ label: `Move up to Platinum · ${mvr(e.offer.platinumPass)}`, item: 'platinum-pass', tier: 'platinum' });
    }
  }

  const venueNote = (e.offer?.venuePercent ?? 0) > 0
    ? `Venue price${e.offer.venueName ? ` at ${e.offer.venueName}` : ''}: ${e.offer.venuePercent}% off passes.`
    : null;

  return {
    name,
    tier,
    line,
    space: a ? `${formatBytes(used)} of ${formatBytes(capacity)} used` : null,
    percent,
    meterTone: percent >= 100 ? 'danger' : percent >= 90 ? 'warning' : 'primary',
    spaceNote,
    alert,
    venueNote,
    actions,
  };
}

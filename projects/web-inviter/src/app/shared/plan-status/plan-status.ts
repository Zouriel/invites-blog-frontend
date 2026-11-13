import { UiStatus } from '@zouriel/ui';
import { localDate } from '../utils/event-time';
import { formatBytes, mvr, planLabel, planTier } from '../utils/plans';
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
  actions: PlanAction[];
};

const DAY = 864e5;

function day(iso: string): string {
  return localDate(iso, 'long');
}

export function planStatus(
  e: BillingEvent, albums: MediaBucket[], keepPrice: number, now = Date.now(), freeBytes = 300 * 1024 ** 2,
): PlanStatus {
  const free = formatBytes(freeBytes);
  const passName = e.pass === 'Platinum' ? 'Platinum pass' : 'Gold pass';
  const passTier = planTier(e.pass) as 'gold' | 'platinum' | null;
  const premium = !e.passActive && e.plan === 'Premium';
  // Organised by an account on Studio (plan kind Venue, 2026-11-12): like Premium, with Studio's space; and
  // when that plan has ended, back on Free like an ended Premium, with a Platinum pass the way to keep it all.
  // Photographer (2026-11-13) is Studio without the AI designer: the same for an event, under its own name.
  const venue = !e.passActive && (e.plan === 'Venue' || e.plan === 'Photographer');
  const venueEnded = e.atVenue && !e.passActive && e.pass === 'None' && e.plan === 'Free';
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
    line = e.passUntil
      ? `${passName} until ${day(e.passUntil)}: everything is kept until then, then up to ${free} forever.`
      : `${passName}: everything is kept while it lasts.`;
  } else if (premium) {
    name = 'Premium';
    tier = 'premium';
    line = 'On your Premium: more space for this event and no mark, everything kept while you subscribe.';
  } else if (venue) {
    name = planLabel(e.plan);
    line = `On ${name}: more space for this event and no mark, everything kept while its organiser stays on ${name}.`;
  } else if (venueEnded) {
    line = `The organiser’s plan has ended, so it is back on Free: up to ${free} is kept forever.`;
  } else if (ended) {
    line = kept
      ? `Its ${passName} has ended. Everything is kept until ${day(kept)}, then up to ${free} forever.`
      : `Its ${passName} has ended, so it is back on Free: up to ${free} is kept forever.`;
  }
  if (e.kind === 'saveTheDate') line = e.passActive ? (e.passUntil ? `${passName} until ${day(e.passUntil)}.` : `${passName}.`) : 'Free.';

  // The warning, in time to back up (retention rule, 2026-11-03): the cut's date and size first.
  let alert: PlanStatus['alert'] = null;
  if (e.trimAt) {
    alert = {
      tone: 'warning',
      heading: `This event goes back to Free on ${day(e.trimAt)}`,
      text: `About ${formatBytes(e.trimBytes ?? 0)} above ${free} will be removed then. Download everything from the album, or ${venueEnded ? 'get a Platinum pass' : 'extend'} to keep it all. The cover photos and the earliest uploads are kept.`,
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


  return {
    name,
    tier,
    line,
    space: a ? `${formatBytes(used)} of ${formatBytes(capacity)} used` : null,
    percent,
    meterTone: percent >= 100 ? 'danger' : percent >= 90 ? 'warning' : 'primary',
    spaceNote,
    alert,
    actions,
  };
}

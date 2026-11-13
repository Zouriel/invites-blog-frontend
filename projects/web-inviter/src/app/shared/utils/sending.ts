import { SendingAllowance } from './types/api.types';

/**
 * What the sending notes say about an event's emailed invitations (owner, 2026-11-14). An event takes each email
 * from its pass first, then the organiser's monthly allowance (Premium 100, Photographer 500, Studio 500 a month,
 * shared by every event they organise, starting again on the 1st, Maldives time), then emails bought for it.
 * Sharing the link, or sending it by hand on WhatsApp, Viber or Telegram, is never counted.
 */
export type SendingSummary = {
  /** One sentence per place the emails come from, e.g. "72 of 500 emails left this month, shared by your events." */
  lines: string[];
  /** Nothing left anywhere. */
  usedUp: boolean;
  /** Why nothing is left, and when the month starts again, for when {@link usedUp}. */
  usedUpLine: string | null;
};

/** "1 December": when the monthly allowance starts again, as a Maldives calendar date. */
export function resetDay(at: string | null | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Indian/Maldives' }).format(d);
}

const emails = (n: number) => `${n.toLocaleString('en-US')} email${n === 1 ? '' : 's'}`;

/**
 * The sentences for one event. `planName` names the event's plan when nothing is included at all ("Free"), so the
 * note says "Emailing guests isn't included on Free." rather than a bare zero. `yours`: the viewer is the organiser,
 * whose monthly allowance it is (a celebrant with full access reads "the organiser's events").
 */
export function sendingSummary(s: SendingAllowance, planName: string, yours = true): SendingSummary {
  const monthly = s.monthly ?? 0;
  const monthlyUsed = s.monthlyUsed ?? 0;
  const monthlyLeft = s.monthlyLeft ?? Math.max(0, monthly - monthlyUsed);
  const eventTotal = s.included + s.extra;
  const eventLeft = s.eventLeft ?? Math.max(0, eventTotal - (s.eventUsed ?? s.used));
  const day = resetDay(s.monthlyResetsAt);

  const lines: string[] = [];
  if (eventTotal > 0) {
    lines.push(
      s.included > 0 && s.extra > 0
        ? `${eventLeft} of ${eventTotal} emails left for this event (${s.included} with its pass, ${s.extra} added).`
        : s.included > 0
          ? `${eventLeft} of the ${s.included} emails its pass includes left for this event.`
          : `${eventLeft} of ${eventTotal} emails added to this event left.`,
    );
  }
  if (monthly > 0) {
    lines.push(`${monthlyLeft} of ${emails(monthly)} left this month, shared by ${yours ? 'your' : "the organiser's"} events${day ? `, ${monthly} again on ${day}` : ''}.`);
  }
  if (!lines.length) lines.push(`Emailing guests isn't included on ${planName}.`);

  const usedUp = s.left <= 0;
  let usedUpLine: string | null = null;
  if (usedUp && (monthly > 0 || eventTotal > 0)) {
    usedUpLine =
      monthly > 0
        ? `This month's ${emails(monthly)} are used${day ? `; they start again on ${day}` : ''}.`
        : `All ${emails(eventTotal)} for this event are used.`;
  }
  return { lines, usedUp, usedUpLine };
}

import { resetDay, sendingSummary } from './sending';
import { SendingAllowance } from './types/api.types';

/** Server shape: total/left/used cover the pass, the organiser's month and bought emails. */
function allowance(a: Partial<SendingAllowance> & { included: number; extra: number }): SendingAllowance {
  const monthly = a.monthly ?? 0;
  const monthlyUsed = a.monthlyUsed ?? 0;
  const eventUsed = a.eventUsed ?? 0;
  const eventLeft = Math.max(0, a.included + a.extra - eventUsed);
  const monthlyLeft = Math.max(0, monthly - monthlyUsed);
  const total = a.included + a.extra + monthly;
  const left = eventLeft + monthlyLeft;
  return { used: total - left, total, left, eventUsed, eventLeft, monthly, monthlyUsed, monthlyLeft, monthlyResetsAt: null, ...a };
}

describe('sendingSummary', () => {
  it("says what's left of the month, shared by the organiser's events, and when it starts again", () => {
    const s = sendingSummary(
      allowance({ included: 0, extra: 0, monthly: 500, monthlyUsed: 428, monthlyResetsAt: '2026-11-30T19:00:00Z' }),
      'Photographer',
    );
    expect(s.lines).toEqual(['72 of 500 emails left this month, shared by your events, 500 again on 1 December.']);
    expect(s.usedUp).toBe(false);
  });

  it("tells a celebrant with full access that the month is the organiser's", () => {
    const s = sendingSummary(allowance({ included: 0, extra: 0, monthly: 100, monthlyUsed: 10 }), 'Premium', false);
    expect(s.lines).toEqual(["90 of 100 emails left this month, shared by the organiser's events."]);
  });

  it('names the pass first and the month after, as they are used', () => {
    const s = sendingSummary(allowance({ included: 100, extra: 0, eventUsed: 40, monthly: 100, monthlyUsed: 0 }), 'Gold pass');
    expect(s.lines[0]).toBe('60 of the 100 emails its pass includes left for this event.');
    expect(s.lines[1]).toContain('100 of 100 emails left this month');
  });

  it('says when the month is used up and when it comes back', () => {
    const s = sendingSummary(
      allowance({ included: 0, extra: 0, monthly: 100, monthlyUsed: 100, monthlyResetsAt: '2026-11-30T19:00:00Z' }),
      'Premium',
    );
    expect(s.usedUp).toBe(true);
    expect(s.usedUpLine).toBe("This month's 100 emails are used; they start again on 1 December.");
  });

  it("says plainly when the event's plan includes no emailing", () => {
    const s = sendingSummary(allowance({ included: 0, extra: 0 }), 'Free');
    expect(s.lines).toEqual(["Emailing guests isn't included on Free."]);
    expect(s.usedUpLine).toBeNull();
  });

  it('reads an older server without the monthly fields', () => {
    const s = sendingSummary({ included: 100, extra: 0, used: 30, total: 100, left: 70 }, 'Gold pass');
    expect(s.lines).toEqual(['70 of the 100 emails its pass includes left for this event.']);
  });

  it('gives the 1st in Maldives time, even late on the last day in UTC', () => {
    expect(resetDay('2026-11-30T19:00:00Z')).toBe('1 December');
    expect(resetDay(null)).toBeNull();
  });
});

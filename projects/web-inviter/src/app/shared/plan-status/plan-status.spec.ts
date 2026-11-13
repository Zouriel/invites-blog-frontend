import { describe, expect, it } from 'vitest';
import { BillingEvent, MediaBucket } from '../utils/types/api.types';
import { planStatus } from './plan-status';

const NOW = Date.parse('2027-01-01T00:00:00Z');
const MB = 1024 ** 2;
const offer = { goldPass: 199, platinumPass: 499, fullGoldPass: 199, fullPlatinumPass: 499, goldExtension: 99, platinumExtension: 349, venuePercent: 0, venueName: null };

const ev = (over: Partial<BillingEvent> = {}): BillingEvent => ({
  campaignId: 'e1', title: 'Aisha & Ali', eventStartAt: '2026-12-20T12:00:00Z', kind: 'invitation', plan: 'Free',
  passUntil: null, keepPhotosUntil: null, coveredUntil: null, phase: 'Active',
  sending: { included: 0, extra: 0, used: 0, total: 0, left: 0 }, atVenue: false, pass: 'None', passActive: false,
  offer: offer as BillingEvent['offer'], isDraft: false, ...over,
});
const album = (usedMb: number, capMb: number): MediaBucket => ({ eventUsedBytes: usedMb * MB, usedBytes: usedMb * MB, capacityBytes: capMb * MB } as MediaBucket);
const s = (e: BillingEvent, albums: MediaBucket[] = [album(120, 300)]) => planStatus(e, albums, 150, NOW);
const labels = (e: BillingEvent, albums?: MediaBucket[]) => s(e, albums).actions.map((a) => `${a.label} [${a.tier ?? 'plain'}]`);

describe('the dashboard plan card (docs/PLANS-UX.md)', () => {
  it('Free: kept forever, both passes offered in their colours, nothing to extend or keep', () => {
    const st = s(ev());
    expect(st.name).toBe('Free');
    expect(st.tier).toBeNull();
    expect(st.line).toContain('kept forever');
    expect(st.space).toBe('120 MB of 300 MB used');
    expect(st.alert).toBeNull();
    expect(labels(ev())).toEqual(['Get Gold · MVR 199 [gold]', 'Get Platinum · MVR 499 [platinum]']);
  });

  it('an active Gold pass: gold, until when, then Free forever; only the move up to Platinum', () => {
    const e = ev({ pass: 'Gold', passActive: true, plan: 'GoldPass', passUntil: '2027-12-20T00:00:00Z' });
    const st = s(e);
    expect(st.tier).toBe('gold');
    expect(st.line).toContain('Gold pass until 20 December 2027');
    expect(st.line).toContain('then up to 300 MB forever');
    expect(labels(e)).toEqual(['Move up to Platinum · MVR 499 [platinum]']);
  });

  it('a Platinum pass ending within a month: warned with the date, extend in platinum, no upgrade', () => {
    const e = ev({ pass: 'Platinum', passActive: true, plan: 'PlatinumPass', passUntil: '2027-01-20T00:00:00Z' });
    const st = s(e);
    expect(st.tier).toBe('platinum');
    expect(st.alert?.heading).toBe('Your Platinum pass ends on 20 January 2027');
    expect(st.alert?.text).toContain('up to 300 MB is kept forever');
    expect(labels(e)).toEqual(['Extend a year · MVR 349 [platinum]']);
  });

  it('a pass that has ended with a cut coming: the date and size, extend in its colour, keep everything', () => {
    const e = ev({ pass: 'Gold', passActive: false, plan: 'Free', passUntil: '2026-12-01T00:00:00Z', trimAt: '2027-01-30T00:00:00Z', trimBytes: 1.5 * 1024 ** 3 });
    const st = s(e, [album(1600, 300)]);
    expect(st.name).toBe('Free');
    expect(st.line).toContain('Its Gold pass has ended');
    expect(st.alert?.heading).toBe('This event goes back to Free on 30 January 2027');
    expect(st.alert?.text).toContain('About 1.5 GB above 300 MB');
    expect(labels(e, [album(1600, 300)])).toEqual(['Extend a year · MVR 99 [gold]', 'Keep everything a year · MVR 150 [plain]']);
  });

  it('a pass that has ended and been kept: no keep offered again, says until when', () => {
    const e = ev({ pass: 'Gold', passActive: false, plan: 'Free', keepPhotosUntil: '2027-11-01T00:00:00Z' });
    expect(s(e).line).toContain('Everything is kept until 1 November 2027');
    expect(labels(e)).toEqual(['Extend a year · MVR 99 [gold]']);
  });

  it('an event on the organiser\'s Premium: premium colour, kept while subscribed, a pass still adds more', () => {
    const e = ev({ plan: 'Premium' });
    const st = s(e, [album(500, 2048)]);
    expect(st.tier).toBe('premium');
    expect(st.name).toBe('Premium');
    expect(st.line).toContain('kept while you subscribe');
    expect(labels(e).map((l) => l.split(' ·')[0])).toEqual(['Get Gold', 'Get Platinum']);
  });

  it("an event its organiser runs on Studio (kind Venue): named Studio, kept while it lasts, no discount talk, passes at the normal price", () => {
    const e = ev({ atVenue: true, plan: 'Venue' });
    const st = s(e, [album(500, 10240)]);
    expect(st.name).toBe('Studio');
    expect(st.line).toContain('kept while its organiser stays on Studio');
    expect(JSON.stringify(st)).not.toMatch(/venue/i);
    expect(JSON.stringify(st)).not.toMatch(/%|off passes|half/i);
    expect(labels(e)).toEqual(['Get Gold · MVR 199 [gold]', 'Get Platinum · MVR 499 [platinum]']);
  });

  it('an event its organiser runs on Photographer: named Photographer, kept while it lasts', () => {
    const st = s(ev({ atVenue: true, plan: 'Photographer' }), [album(500, 10240)]);
    expect(st.name).toBe('Photographer');
    expect(st.line).toContain('kept while its organiser stays on Photographer');
  });

  it("an organiser's Studio plan that ended: back on Free, the cut warned, a Platinum pass offered to keep it all", () => {
    const e = ev({ atVenue: true, plan: 'Free', trimAt: '2027-01-10T00:00:00Z', trimBytes: 2 * 1024 ** 3 });
    const st = s(e, [album(2300, 300)]);
    expect(st.name).toBe('Free');
    expect(st.line).toContain('The organiser’s plan has ended');
    expect(st.alert?.text).toContain('get a Platinum pass to keep it all');
    expect(labels(e)).toContain('Get Platinum · MVR 499 [platinum]');
  });

  it('nearly full and full say so; the meter turns warning then danger', () => {
    expect(s(ev(), [album(280, 300)]).spaceNote).toContain('Almost full');
    expect(s(ev(), [album(280, 300)]).meterTone).toBe('warning');
    const full = s(ev(), [album(300, 300)]);
    expect(full.spaceNote).toContain('Full');
    expect(full.meterTone).toBe('danger');
    const top = s(ev({ pass: 'Platinum', passActive: true, plan: 'PlatinumPass', passUntil: '2027-12-01T00:00:00Z' }), [album(10240, 10240)]);
    expect(top.spaceNote).toContain('largest pass');
    expect(s(ev(), [album(100, 300)]).spaceNote).toBeNull();
  });

  it('a pass with no end date says so instead of failing', () => {
    expect(s(ev({ pass: 'Gold', passActive: true, plan: 'GoldPass', passUntil: null })).line).toBe('Gold pass: everything is kept while it lasts.');
  });

  it('a save the date: plain, no space talk, no keep', () => {
    const st = s(ev({ kind: 'saveTheDate' }), []);
    expect(st.line).toBe('Free.');
    expect(st.space).toBeNull();
    expect(st.actions.some((a) => a.item === 'keep-photos')).toBe(false);
  });
});

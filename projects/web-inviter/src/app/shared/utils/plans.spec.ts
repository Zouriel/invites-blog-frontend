import { describe, expect, it } from 'vitest';
import { PLAN_CATALOG, catalog, formatBytes, mvr, passSummary, plan, planLabel, planTier, setCatalog, spaceLadder, usd, windowLine } from './plans';

/** The built-in catalog must say what the server's PlanCatalog says (see PlanRulesTests there). */
describe('planTier', () => {
  it('wears gold for a Gold pass and platinum for a Platinum pass, by kind or by event pass', () => {
    expect(planTier('GoldPass')).toBe('gold');
    expect(planTier('Gold')).toBe('gold');
    expect(planTier('PlatinumPass')).toBe('platinum');
    expect(planTier('Platinum')).toBe('platinum');
  });

  it('leaves every other plan on its tone', () => {
    for (const kind of ['Free', 'Premium', 'Venue', 'None', '', null, undefined]) expect(planTier(kind)).toBeNull();
  });
});

describe('plans', () => {
  it('lists the plans at the server’s prices, in rufiyaa', () => {
    expect(PLAN_CATALOG.currency).toBe('MVR');
    expect(PLAN_CATALOG.plans.map((p) => [p.kind, p.price])).toEqual([
      ['Free', 0],
      ['GoldPass', 199],
      ['PlatinumPass', 699],
      ['Premium', 200],
      ['Venue', 2300],
    ]);
    // Venues pay by the month and buy their events' passes at half price (the server's Prices.Defaults).
    expect(PLAN_CATALOG.venueDiscountPercent).toBe(50);
    // Premium lifts each of its subscriber's events to 2 GB without the mark, kept while it lasts.
    expect(plan('Premium')).toMatchObject({ billing: 'per month', eventBytes: 2 * 1024 ** 3, branded: false, retentionDays: null });
    expect(PLAN_CATALOG.keepPhotos.price).toBe(150);
    expect(PLAN_CATALOG.sending).toEqual({ perBlock: 50, blockSize: 100 });
    // Another year of a pass, without invitations: half the pass (the server's Prices.Defaults).
    expect(plan('GoldPass').extensionPrice).toBe(99);
    expect(plan('PlatinumPass').extensionPrice).toBe(349);
  });

  it('writes plan sentences from the catalog', () => {
    expect(spaceLadder()).toBe('300 MB free, 5 GB with a Gold pass and 10 GB with a Platinum pass');
    expect(passSummary(plan('PlatinumPass'))).toBe('10 GB, 5 albums, photos until 5 days after, private albums, 500 invitations sent');
    expect(windowLine(1)).toBe('from the day before to the day after');
    expect(windowLine(3)).toBe('until 3 days after it starts');
    expect(planLabel('GoldPass')).toBe('Gold pass');
    expect(planLabel('Premium')).toBe('Premium pass');
    expect(mvr(4500)).toBe('MVR 4,500');
    expect(usd(699)).toBe('≈ $45');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('follows the prices the server serves, and ignores a catalog it cannot read', () => {
    const changed = {
      ...PLAN_CATALOG,
      mvrPerUsd: 10,
      plans: PLAN_CATALOG.plans.map((p) => (p.kind === 'GoldPass' ? { ...p, price: 249 } : p)),
    };
    try {
      setCatalog(changed);
      expect(plan('GoldPass').price).toBe(249);
      expect(usd(250)).toBe('≈ $25');
      setCatalog({ ...changed, plans: [] });
      setCatalog(null);
      expect(catalog()).toBe(changed);
    } finally {
      setCatalog(PLAN_CATALOG);
    }
    expect(plan('GoldPass').price).toBe(199);
  });
});

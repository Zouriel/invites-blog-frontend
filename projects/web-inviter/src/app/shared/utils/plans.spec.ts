import { describe, expect, it } from 'vitest';
import { PLAN_CATALOG, catalog, formatBytes, mvr, passSummary, plan, planLabel, setCatalog, spaceLadder, usd, windowLine } from './plans';

/** The built-in catalog must say what the server's PlanCatalog says (see PlanRulesTests there). */
describe('plans', () => {
  it('lists the plans at the server’s prices, in rufiyaa', () => {
    expect(PLAN_CATALOG.currency).toBe('MVR');
    expect(PLAN_CATALOG.plans.map((p) => [p.kind, p.price])).toEqual([
      ['Free', 0],
      ['PartyPass', 199],
      ['WeddingPass', 699],
      ['Studio', 450],
      ['Venue', 2300],
    ]);
    expect(PLAN_CATALOG.keepPhotos.price).toBe(150);
    expect(PLAN_CATALOG.sending).toEqual({ perBlock: 50, blockSize: 100 });
    expect(plan('WeddingPass').studioPrice).toBe(489);
  });

  it('writes plan sentences from the catalog', () => {
    expect(spaceLadder()).toBe('1 GB free, 10 GB with a Party pass and 100 GB with a Wedding pass');
    expect(passSummary(plan('WeddingPass'))).toBe('100 GB, 5 albums, photos until 5 days after, private albums, 500 invitations sent');
    expect(windowLine(1)).toBe('from the day before to the day after');
    expect(windowLine(3)).toBe('until 3 days after it starts');
    expect(planLabel('PartyPass')).toBe('Party pass');
    expect(mvr(4500)).toBe('MVR 4,500');
    expect(usd(699)).toBe('≈ $45');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('follows the prices the server serves, and ignores a catalog it cannot read', () => {
    const changed = {
      ...PLAN_CATALOG,
      mvrPerUsd: 10,
      plans: PLAN_CATALOG.plans.map((p) => (p.kind === 'PartyPass' ? { ...p, price: 249 } : p)),
    };
    try {
      setCatalog(changed);
      expect(plan('PartyPass').price).toBe(249);
      expect(usd(250)).toBe('≈ $25');
      setCatalog({ ...changed, plans: [] });
      setCatalog(null);
      expect(catalog()).toBe(changed);
    } finally {
      setCatalog(PLAN_CATALOG);
    }
    expect(plan('PartyPass').price).toBe(199);
  });
});

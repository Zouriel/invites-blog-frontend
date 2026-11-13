import { describe, expect, it } from 'vitest';
import { PLAN_CATALOG, accountDownloadsAll, addOnNote, catalog, designerAddOn, designerAiOn, downloadLimit, formatBytes, mvr, passSummary, perksOf, plan, planLabel, planTier, setCatalog, spaceLadder, usd, windowLine } from './plans';

/** The built-in catalog must say what the server's PlanCatalog says (see PlanRulesTests there). */
describe('planTier', () => {
  it('wears gold for a Gold pass and platinum for a Platinum pass, by kind or by event pass', () => {
    expect(planTier('GoldPass')).toBe('gold');
    expect(planTier('Gold')).toBe('gold');
    expect(planTier('PlatinumPass')).toBe('platinum');
    expect(planTier('Platinum')).toBe('platinum');
    expect(planTier('Premium')).toBe('premium');
  });

  it('leaves every other plan on its tone', () => {
    for (const kind of ['Free', 'Venue', 'None', '', null, undefined]) expect(planTier(kind)).toBeNull();
  });
});

describe('plans', () => {
  it('lists the plans at the server’s prices, in rufiyaa', () => {
    expect(PLAN_CATALOG.currency).toBe('MVR');
    expect(PLAN_CATALOG.plans.map((p) => [p.kind, p.price])).toEqual([
      ['Free', 0],
      ['GoldPass', 199],
      ['PlatinumPass', 499],
      ['Premium', 77],
      ['Photographer', 540],
      ['Venue', 775],
    ]);
    // Photographer (2026-11-13): Studio's limits for every event, without the AI designer.
    expect(plan('Photographer')).toMatchObject({ billing: 'per month', eventBytes: 10 * 1024 ** 3, maxBuckets: 1, branded: false, retentionDays: null });
    // Studio, kind Venue (owner, 2026-11-12): no discount on passes any more; every event its subscriber organises is like
    // Premium with 10 GB, one album, no mark, kept while the plan lasts.
    expect(PLAN_CATALOG.venueDiscountPercent).toBe(0);
    expect(plan('Venue')).toMatchObject({ billing: 'per month', eventBytes: 10 * 1024 ** 3, maxBuckets: 1, maxWindowDays: 1, branded: false, retentionDays: null, includedInvites: 0, privateAlbums: false });
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
    expect(planLabel('Premium')).toBe('Premium');
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

describe('free albums kept forever (owner, 2026-11-03)', () => {
  it('gives Free no retention days, and the pricing FAQ says free albums are kept forever', async () => {
    const { PLAN_CATALOG, BACK_TO_FREE } = await import('./plans');
    expect(PLAN_CATALOG.plans.find((p) => p.kind === 'Free')!.retentionDays).toBeNull();
    expect(BACK_TO_FREE).toEqual({ noticeDays: 30, reminderDaysBefore: 7, finalDaysBefore: 1 });
    const { pricingFaq } = await import('../../pages/pricing/pricing-faq');
    const text = pricingFaq().map((f) => f.a).join(' ');
    expect(text).toContain('Free albums are kept forever');
    expect(text).not.toMatch(/90 days|only you can for another/);
  });
});

describe('pricing 2026-11 (docs/PRICING-2026-11.md)', () => {
  it('sells the AI designer as an add-on to Premium: MVR 77 (about $5) a month, 10 at a time without Download all', () => {
    expect(designerAddOn()).toMatchObject({ key: 'designer-ai', price: 77, usd: 5, forKinds: ['Premium'] });
    expect(addOnNote(designerAddOn())).toBe('+MVR 77 a month, about $5');
    expect(downloadLimit()).toBe(10);
  });

  it("draws a card's bullets from the server's perks, and only writes its own for a server that sends none", () => {
    expect(perksOf({ ...plan('Premium'), perks: ['From the server'] })).toEqual(['From the server']);
    expect(perksOf(plan('Premium')).join(' ')).toContain('2 GB');
    // Premium's own bullets never promise the AI designer: it is the add-on.
    expect(perksOf(plan('Premium')).join(' ')).not.toMatch(/AI/);
    expect(perksOf(plan('Venue')).join(' ')).toContain('AI designer');
    expect(perksOf(plan('Photographer')).join(' ')).not.toMatch(/AI/);
    expect(perksOf(plan('Photographer')).join(' ')).toContain('portfolio');
  });

  it('names Photographer and lets it download everything', () => {
    expect(planLabel('Photographer')).toBe('Photographer');
    expect(planLabel('Venue')).toBe('Studio');
    expect(accountDownloadsAll({ subscriptionTier: 'Photographer', subscriptionEndsAt: null } as never)).toBe(true);
  });

  it('reads the AI designer and Download all from the account, with the plan for an older server', () => {
    expect(designerAiOn([{ key: 'designer-ai', active: true, renews: false, endsAt: null }])).toBe(true);
    expect(designerAiOn([{ key: 'designer-ai', active: false, renews: false, endsAt: null }])).toBe(false);
    expect(designerAiOn(undefined)).toBe(false);
    const base = { id: 'a', email: null, phoneE164: null, displayName: 'A', isActive: true, hasPassword: false, roles: [], linkedProviders: [] };
    expect(accountDownloadsAll({ ...base, canDownloadAll: false, subscriptionTier: 'Premium' })).toBe(false);
    expect(accountDownloadsAll({ ...base, subscriptionTier: 'Premium', subscriptionEndsAt: null })).toBe(true);
    expect(accountDownloadsAll({ ...base, subscriptionTier: 'Premium', subscriptionEndsAt: '2020-01-01T00:00:00Z' })).toBe(false);
    expect(accountDownloadsAll({ ...base, subscriptionTier: 'None' })).toBe(false);
    expect(accountDownloadsAll(null)).toBe(false);
  });
});

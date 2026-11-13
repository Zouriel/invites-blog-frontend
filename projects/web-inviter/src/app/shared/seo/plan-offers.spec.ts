import { describe, expect, it } from 'vitest';
import { PLAN_CATALOG } from '../utils/plans';
import { planOffers, productJsonLd } from './plan-offers';

/** The offers search engines and AI assistants read: every plan at its price, Photographer included (2026-11-13). */
describe('planOffers', () => {
  const offers = planOffers(PLAN_CATALOG) as { name: string; price: string; priceCurrency: string }[];
  const at = (name: string, currency: string) => offers.find((o) => o.name === name && o.priceCurrency === currency)?.price;

  it('lists every plan in rufiyaa, by its shown name', () => {
    expect(at('Free', 'MVR')).toBe('0');
    expect(at('Gold pass', 'MVR')).toBe('199');
    expect(at('Platinum pass', 'MVR')).toBe('499');
    expect(at('Premium', 'MVR')).toBe('77');
    expect(at('Photographer', 'MVR')).toBe('540');
    expect(at('Studio', 'MVR')).toBe('775');
    expect(offers.some((o) => o.name === 'Venue')).toBe(false);
  });

  it("gives the monthly plans the app's dollar price and the AI designer as Premium's add-on", () => {
    expect(at('Premium (in the iPhone app)', 'USD')).toBe('4.99');
    expect(at('Photographer (in the iPhone app)', 'USD')).toBe('34.99');
    expect(at('Studio (in the iPhone app)', 'USD')).toBe('49.99');
    expect(at('AI designer, an add-on to Premium', 'MVR')).toBe('77');
  });

  it('follows a price an admin changed', () => {
    const changed = { ...PLAN_CATALOG, plans: PLAN_CATALOG.plans.map((p) => (p.kind === 'Photographer' ? { ...p, price: 600 } : p)) };
    expect((productJsonLd(changed) as { offers: { name: string; price: string }[] }).offers.find((o) => o.name === 'Photographer')?.price).toBe('600');
  });
});

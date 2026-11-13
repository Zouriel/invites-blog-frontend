import { catalog, designerAddOn } from '../utils/plans';
import type { PlanCatalog } from '../utils/types/api.types';

/**
 * What the iPhone app charges for each monthly plan, in US dollars (the App Store and Google Play tiers in
 * docs/PRICING-STORES.md). Passes are sold in the stores too, but the website is where they are priced, so only the
 * subscriptions carry a dollar offer here.
 */
export const STORE_USD: Record<string, number> = {
  Premium: 4.99,
  Photographer: 34.99,
  Venue: 49.99,
};

/** The AI designer add-on in the stores: Premium with it is $9.99 instead of $4.99. */
export const AI_ADDON_USD = 5;

type Offer = Record<string, unknown>;

/**
 * Every plan as schema.org Offers, for the structured data search engines and AI assistants read: the website's
 * price in rufiyaa (from the catalog in force, so an admin's price change reaches it), and for the monthly plans
 * the app's price in dollars too. Shown names, not internal kinds (Venue is Studio).
 */
export function planOffers(c: PlanCatalog = catalog()): Offer[] {
  const offers: Offer[] = [];
  const monthly = (p: number, currency: string) => ({
    '@type': 'UnitPriceSpecification', price: String(p), priceCurrency: currency, billingDuration: 'P1M', unitText: 'MONTH',
  });
  for (const p of c.plans) {
    const monthlyPlan = p.billing === 'per month';
    offers.push({
      '@type': 'Offer',
      name: p.name,
      price: String(p.price),
      priceCurrency: c.currency,
      ...(monthlyPlan ? { priceSpecification: monthly(p.price, c.currency) } : {}),
      description: (p.perks ?? []).join('. ') || undefined,
      url: 'https://invites.blog/pricing',
    });
    const usd = STORE_USD[p.kind];
    if (monthlyPlan && usd) {
      offers.push({
        '@type': 'Offer',
        name: `${p.name} (in the iPhone app)`,
        price: String(usd),
        priceCurrency: 'USD',
        priceSpecification: monthly(usd, 'USD'),
        url: 'https://invites.blog/pricing',
      });
    }
  }
  const ai = designerAddOn(c);
  offers.push({
    '@type': 'Offer',
    name: `${ai.name}, an add-on to Premium`,
    price: String(ai.price),
    priceCurrency: c.currency,
    priceSpecification: monthly(ai.price, c.currency),
    description: `The template designer's Ask AI assistant, added to Premium. In the iPhone app: +$${AI_ADDON_USD} a month.`,
    url: 'https://invites.blog/pricing',
  });
  return offers;
}

/** The product with every plan as an offer: on the landing and Plans pages. */
export function productJsonLd(c: PlanCatalog = catalog()): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'invites.blog',
    url: 'https://invites.blog',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS',
    description:
      "Animated invitations personalised for every guest, a free in-browser template designer, one-tap RSVP, photo albums every guest adds to with a camera in the invitation or a QR code, and portfolio pages for photographers and studios.",
    offers: planOffers(c),
  };
}

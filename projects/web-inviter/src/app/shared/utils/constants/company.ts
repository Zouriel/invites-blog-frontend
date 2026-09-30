import { environment } from '../../../../environments/environment';

/**
 * Who runs invites.blog, as the bank's card rules require it to be shown: the footer, the contact
 * page, the legal pages and the checkout all read it from here, so one change reaches every place.
 */
export const COMPANY = {
  /** The trading name as registered: the business activity invites.blog is run under. The brand everywhere else stays "invites.blog". */
  tradingName: 'invitesblog',
  /** The registered business that invitesblog is an activity of, as registered (capitals). */
  legalName: 'CORBETT',
  registrationNumber: 'SP31072026',
  /** Where the business is, which is also where post goes. */
  address: ['RANGAL', 'Violet Magu', 'GDh. Thinadhoo 17100', 'Maldives'],
  country: 'Maldives',
  email: 'mohamed.imdaah@gmail.com',
  /** Shown with the country code; `phoneHref` is the same number for a tel: link. */
  phone: '+960 781 9157',
  phoneHref: '+9607819157',
  /** Charges are made in this currency, by this bank, in this country. */
  currency: 'MVR',
  currencyName: 'Maldivian rufiyaa',
  acquirer: 'Bank of Maldives',
} as const;

/**
 * The currency cards are actually charged in, for the wording on the pricing and policy pages.
 * Rufiyaa in production; staging's BML test account only takes dollars, so it charges the rufiyaa
 * price in dollars and says so.
 */
export const CHARGE =
  environment.chargeCurrency === 'USD'
    ? { code: 'USD', name: 'US dollars', note: ' (the rufiyaa price in dollars; the exact amount is shown before you pay)' }
    : { code: 'MVR', name: 'Maldivian rufiyaa', note: '' };

/** The address on one line: "RANGAL, Violet Magu, GDh. Thinadhoo 17100, Maldives". */
export const COMPANY_ADDRESS_LINE = COMPANY.address.join(', ');

/**
 * The version of the terms a buyer accepts at checkout, recorded with the payment. Change it whenever
 * the Terms, Refund or Privacy pages change in a way that matters to someone paying; the server keeps
 * the same value (LegalTerms.Version).
 */
export const TERMS_VERSION = '2026-09-29';

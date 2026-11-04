import { parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js/min';
import { UI_PHONE_COUNTRIES, uiPhoneCountry, uiPhoneSplit } from '@zouriel/ui/form';

/**
 * Phone numbers, for every country: `ui-phone-input` gives an E.164 string ("+447700900123"), this
 * checks it with libphonenumber before anything is sent, and says what's wrong in words.
 *
 * <p>There is no built-in country. The input starts on the signed-in account's country, else the
 * visitor's (from Cloudflare, GET /api/geo), else none, and the person can change it per number.</p>
 */

export { knownCountry, pickDefaultCountry } from './country';

/** The country an E.164 number belongs to ("GB" for +44…), or null. */
export function phoneCountryOf(e164: string | null | undefined): string | null {
  if (!e164) return null;
  return parsePhoneNumberFromString(e164)?.country ?? null;
}

/**
 * What's wrong with a number, in words, or null when it's fine (or empty: whether a number is needed
 * at all is the form's call).
 */
export function phoneProblem(e164: string | null | undefined): string | null {
  const v = (e164 ?? '').trim();
  if (!v) return null;
  if (!v.startsWith('+')) return 'Pick the country for this number.';
  const parsed = parsePhoneNumberFromString(v);
  // libphonenumber names no country for a number too short to tell; the dial code still does.
  const country = parsed?.country
    ? uiPhoneCountry(parsed.country)?.name
    : uiPhoneSplit(v.slice(1).replace(/\D/g, ''))?.country.name;
  const where = country ? ` for ${country}` : '';
  const length = validatePhoneNumberLength(v);
  if (length === 'TOO_SHORT') return `That number is too short${where}. Check the digits.`;
  if (length === 'TOO_LONG') return `That number is too long${where}. Check the digits.`;
  if (!parsed || !parsed.isValid()) return `That doesn't look like a valid number${where}. Check the country and the digits.`;
  return null;
}

/** "+44 7700 900123" for showing a stored E.164 number; the input as given when it can't be read. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

export type { CountryCode };

/** Every country, for a picker: "United Kingdom (+44)" → "GB". */
export function countryOptions(): { label: string; value: string }[] {
  return UI_PHONE_COUNTRIES.map((c) => ({ label: `${c.name} (+${c.dial})`, value: c.iso2 }));
}

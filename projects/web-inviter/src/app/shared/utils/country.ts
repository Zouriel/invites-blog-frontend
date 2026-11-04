/**
 * Country codes without the phone metadata, so the root-level RegionService stays out of the phone
 * library's weight (libphonenumber and the country list load only with pages that take a number).
 */

/** An ISO 3166 alpha-2 code ("GB"), upper-cased, or null. "XX" (unknown) and "T1" (Tor) are not countries. */
export function knownCountry(iso2: string | null | undefined): string | null {
  const v = (iso2 ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1' ? v : null;
}

/**
 * The first default that is a real country: the account's, then the visitor's. Null when neither is
 * known; the input then starts with no country picked rather than assuming one.
 */
export function pickDefaultCountry(accountCountry: string | null | undefined, geoCountry: string | null | undefined): string | null {
  return knownCountry(accountCountry) ?? knownCountry(geoCountry);
}

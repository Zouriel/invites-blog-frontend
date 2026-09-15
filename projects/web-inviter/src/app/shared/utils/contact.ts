/**
 * Client-side checks for a guest's contact details, shared by the manual guest list and the review
 * page's single "add a guest" form.
 *
 * <p>The server is still the authority (it validates and de-duplicates on save). These exist so a
 * host finds a typo while the row is in front of them, instead of a batch save failing on one row
 * out of forty with a toast that doesn't say which.</p>
 */

/**
 * Deliberately loose: something@something.tld with no spaces. Anything stricter starts refusing real
 * addresses (plus-tags, long TLDs, unicode), and the only goal here is catching a slip of the thumb.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string | null | undefined): boolean {
  const v = value?.trim() ?? '';
  return v === '' || EMAIL.test(v);
}

/** The form an email is compared in: addresses are case-insensitive in practice. */
export function emailKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/** The form a phone number is compared in: digits only, so "+960 777-1234" matches "9607771234". */
export function phoneKey(value: string | null | undefined): string {
  return value?.replace(/\D/g, '') ?? '';
}

/** Per-row problems in a list of guests. Blank values never count as duplicates. */
export interface ContactIssues {
  invalidEmail: boolean;
  duplicateEmail: boolean;
  duplicatePhone: boolean;
}

export function contactIssues(rows: { email?: string | null; phone?: string | null }[]): ContactIssues[] {
  const count = (keys: string[]) => {
    const seen = new Map<string, number>();
    for (const k of keys) if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    return seen;
  };
  const emails = rows.map((r) => emailKey(r.email));
  const phones = rows.map((r) => phoneKey(r.phone));
  const emailCounts = count(emails);
  const phoneCounts = count(phones);

  return rows.map((r, i) => ({
    invalidEmail: !isValidEmail(r.email),
    duplicateEmail: !!emails[i] && (emailCounts.get(emails[i]) ?? 0) > 1,
    duplicatePhone: !!phones[i] && (phoneCounts.get(phones[i]) ?? 0) > 1,
  }));
}

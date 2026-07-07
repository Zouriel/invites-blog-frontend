/** localStorage / sessionStorage keys used across the invitee app. */
export const STORAGE_KEYS = {
  /** Long-lived invitee JWT (localStorage). */
  jwt: 'ib_jwt',
  /** In-flight OTP challenge id (sessionStorage). */
  challenge: 'ib_challenge',
  /** OTP expiry hint in seconds (sessionStorage). */
  expires: 'ib_expires',
  /** Human-readable destination the OTP was sent to (sessionStorage). */
  dest: 'ib_dest',
} as const;

/** Default dialling code / country for the phone login (Maldives). */
export const DEFAULT_COUNTRY_CODE = '+960';
export const DEFAULT_COUNTRY = 'MV';

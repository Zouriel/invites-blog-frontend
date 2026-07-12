/** localStorage / sessionStorage keys used across the invitee app. */
export const STORAGE_KEYS = {
  /** Long-lived invitee JWT (localStorage). */
  jwt: 'ib_jwt',
  /** In-flight OTP challenge id (sessionStorage). */
  challenge: 'ib_challenge',
  /** Human-readable destination the OTP was sent to (sessionStorage). */
  dest: 'ib_dest',
} as const;

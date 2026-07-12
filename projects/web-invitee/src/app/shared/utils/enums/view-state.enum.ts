/** Render states for the sandboxed invite views (`/i/:token`, `/e/:campaignId`). */
export enum InviteViewState {
  Loading = 'loading',
  Ready = 'ready',
  Otp = 'otp',
  Cancelled = 'cancelled',
  Error = 'error',
  /** The verified email isn't on the campaign's guest list. */
  NotOnList = 'not-on-list',
}

/** Render states for the privacy self-service removal page. */
export enum PrivacyState {
  Loading = 'loading',
  Confirm = 'confirm',
  Already = 'already',
  Done = 'done',
  Error = 'error',
}

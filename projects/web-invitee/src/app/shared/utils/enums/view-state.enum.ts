/** Render states for the sandboxed token invite view (`/i/:token`). */
export enum InviteViewState {
  Loading = 'loading',
  Ready = 'ready',
  Otp = 'otp',
  Cancelled = 'cancelled',
  Error = 'error',
}

/** Render states for the privacy self-service removal page. */
export enum PrivacyState {
  Loading = 'loading',
  Confirm = 'confirm',
  Already = 'already',
  Done = 'done',
  Error = 'error',
}

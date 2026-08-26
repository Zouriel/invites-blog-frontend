import { OtpChannel } from '../enums/otp-channel.enum';
import { RsvpStatus } from '../enums/rsvp-status.enum';

/** A single structured error entry inside the response envelope. */
export type ApiErrorItem = {
  message: string;
  field?: string | null;
  code?: string | null;
};

/**
 * The uniform response envelope every endpoint now returns. `ApiService`
 * unwraps `.data` on success and surfaces `message`/`errors` on failure.
 */
export type ApiEnvelope<T> = {
  success: boolean;
  message: string | null;
  data: T | null;
  errors: ApiErrorItem[] | null;
};

// --- Auth capabilities ---
/**
 * What sign-in methods this server actually has configured. `smsAvailable` is false until a MsgOwl
 * API key is set, so the phone option is hidden rather than offered and then rejected.
 */
export type AuthOptions = {
  smsAvailable: boolean;
};

// --- Contact links ---
/**
 * A second contact we could add to this inbox — discovered from guest rows a host uploaded, so it is
 * only ever an offer. `masked` is the only form the server discloses; it is also the handle used to
 * request a code, so an arbitrary address can't be probed.
 */
export type LinkableContact = {
  contactType: 'email' | 'phone';
  masked: string;
  inviteCount: number;
};

export type ContactLinkResult = {
  linked: boolean;
  contactType: 'email' | 'phone';
  masked: string;
};

// --- OTP ---
export type OtpRequestBody = {
  channel: OtpChannel;
  phone?: string;
  email?: string;
  defaultCountry?: string;
};

export type OtpRequestResult = {
  challengeId: string;
  expiresInSeconds: number;
};

/**
 * Result of a guest-list-gated OTP request for the shared campaign link. A code is emailed (and a
 * challengeId returned) only when `invited` is true; otherwise the caller shows a not-invited/cancelled
 * message and no email is sent.
 */
export type CampaignOtpResult = {
  invited: boolean;
  cancelled: boolean;
  challengeId: string | null;
  expiresInSeconds: number;
};

export type OtpVerifyBody = {
  challengeId: string;
  code: string;
};

export type OtpVerifyResult = {
  accessToken: string;
  refreshToken: string;
};

/**
 * A reauth code was sent for a personal invite link (/i/:token) opened from a device/location the
 * link doesn't already trust. `channel` says where to look ("email" or "sms") without exposing the
 * actual address. Verifying it (see `verifyInviteReauth`) trusts this device for the invite — it does
 * NOT sign the visitor into an account, unlike the regular OTP flow.
 */
export type InviteReauthRequestResult = {
  challengeId: string;
  expiresInSeconds: number;
  channel: 'email' | 'sms';
};

// --- Inbox ---
export type InboxCard = {
  inviteId: string;
  eventTitle: string;
  eventDate: string;
  venueType: string;
  rsvpStatus: string;
  isNew: boolean;
  isPast: boolean;
  cancelled: boolean;
};
/** Rendered invite for the OTP-authenticated guest via the shared campaign link (/e/{id}). */
export type MyInvite = {
  packageUrl: string;
  data?: unknown;
  campaignStatus?: string;
  cancelled?: boolean;
  message?: string;
  inviteId: string;
  rsvpStatus?: string;
  rsvpQuestions?: RsvpQuestion[];
};

/**
 * GET /api/invites/by-token/{token} — the per-guest tokenized link (/i/{token}). Union of three shapes:
 * a rendered view (packageUrl+data), a cancelled event, or a sensitive invite that still requires OTP.
 */
export type InviteByToken = {
  packageUrl?: string;
  data?: unknown;
  campaignStatus?: string;
  cancelled?: boolean;
  message?: string;
  requiresOtp?: boolean;
  rsvpQuestions?: RsvpQuestion[];
};

// --- RSVP ---

/** One thing the host chose to ask. Keys are assigned server-side; answers are filed under them. */
export type RsvpQuestion = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'yesno';
  required?: boolean;
  askIfNotGoing?: boolean;
  options?: string[];
};

export type RsvpBody = {
  status: RsvpStatus;
  guestCount?: number;
  mealPreference?: string;
  comment?: string;
  arrivalTime?: string;
  contactNote?: string;
  /** Answers to whatever else the host asked. */
  answers?: Record<string, string>;
};

export type RsvpResult = {
  rsvp: string;
};

// --- Privacy self-service ---
export type PrivacyRemoveInfo = {
  guestName: string;
  eventTitle: string;
  hasEmail: boolean;
  hasPhone: boolean;
  alreadyRemoved: boolean;
};

export type PrivacyRemoveResult = {
  removed: boolean;
};

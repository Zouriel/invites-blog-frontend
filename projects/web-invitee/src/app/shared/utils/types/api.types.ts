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

export type ClaimResult = {
  claimed: boolean;
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
};

// --- RSVP ---
export type RsvpBody = {
  status: RsvpStatus;
  guestCount?: number;
  mealPreference?: string;
  comment?: string;
  arrivalTime?: string;
  contactNote?: string;
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

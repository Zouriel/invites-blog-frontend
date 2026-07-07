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

/** GET /api/invites/by-token/{token} — union of the three documented shapes. */
export type InviteByToken = {
  requiresOtp?: boolean;
  cancelled?: boolean;
  message?: string;
  packageUrl?: string;
  data?: unknown;
  campaignStatus?: string;
  error?: string;
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

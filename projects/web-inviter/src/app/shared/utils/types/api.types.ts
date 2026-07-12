/**
 * Request/response types for the invites.blog API.
 * All aliases (no `interface`), no `any`.
 */

/** Standard envelope every endpoint now returns. */
export type ApiError = {
  message: string;
  field: string | null;
  code: string | null;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string | null;
  data: T | null;
  errors: ApiError[] | null;
};

export type Template = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  previewImageUrl: string | null;
  previewAnimationUrl: string | null;
  isPremium: boolean;
  designerName: string;
  packageUrl: string;
  version: string;
  manifestJson?: string;
  /** A used dedicated template: shown in the gallery for viewing only — not selectable. */
  isShowcase?: boolean;
};

/* --- Custom-invitation inquiries --- */
export type SubmitInquiryBody = {
  name: string;
  email: string;
  occasion: string;
  message: string;
};
export type InquiryListItem = {
  id: string;
  name: string;
  email: string;
  occasion: string;
  hasAttended: boolean;
  templateIssued: boolean;
  createdAt: string;
};
export type InquiryPage = {
  items: InquiryListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
export type InquiryDetail = {
  id: string;
  name: string;
  email: string;
  occasion: string;
  message: string;
  colors: string | null;
  references: string | null;
  notes: string | null;
  hasAttended: boolean;
  attendedAt: string | null;
  templateIssued: boolean;
  templateIssuedAt: string | null;
  issuedTemplateId: string | null;
  createdAt: string;
};
export type UpdateInquiryBody = {
  colors: string | null;
  references: string | null;
  notes: string | null;
  hasAttended: boolean;
};
export type InquiryIssued = { templateId: string; slug: string; emailed: boolean };

/** An admin management row for a template — every template plus how many campaigns use it. */
export type AdminTemplate = {
  id: string;
  name: string;
  slug: string;
  category: string;
  version: string;
  packageUrl: string;
  visibility: string;
  isActive: boolean;
  assignedEmail: string | null;
  campaignCount: number;
};

/** Outcome of deleting a template: hard-deleted, or deactivated because campaigns still use it. */
export type DeleteTemplateResult = {
  deleted: boolean;
  deactivated: boolean;
  campaignCount: number;
};

/** A template category, now a first-class backend entity. */
export type TemplateTypeDto = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type Paged<T> = {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
};

/** Matches the backend PagedResult envelope (items + paging metadata). */
export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type CreateCampaignResponse = {
  campaignId: string;
  status: string;
  accessToken: string;
};

/** Result of finalizing a campaign: the shareable /e/{id} link + how many guests were emailed it. */
export type FinalizeResult = {
  shareLink: string;
  guestCount: number;
  emailed: number;
};

/** One fillable image on a template (a `data-src` path + a human label), from the manifest. */
export type TemplateImageSlot = {
  key: string;
  label: string;
};

/** One fillable text/link field on a template (a `data-var`/`data-href` path + label + widget type). */
export type TemplateFieldSlot = {
  key: string;
  label: string;
  type: string; // text | textarea | date | time | url
};

/** The parts of a template manifest the builder reads. */
export type TemplateManifest = {
  variables?: string[];
  contentBlocks?: string[];
  imageSlots?: TemplateImageSlot[];
  fields?: TemplateFieldSlot[];
};

/** Result of uploading a campaign image — the stored public URL. */
export type CampaignImageResult = {
  url: string;
};

/** JSON stored inside customContentJson (spec content shape). */
export type CustomContent = {
  title?: string;
  subtitle?: string;
  description?: string;
  date?: string;
  time?: string;
  venueName?: string;
  venueAddress?: string;
  schedule?: string;
  dressCode?: string;
  /** Inviter-filled text/link fields, keyed by the template field's `data-var`/`data-href` path. */
  fields?: Record<string, string>;
  /** Inviter-selected images, keyed by the template slot's `data-src` path. */
  imageSlots?: Record<string, string>;
};

export type ContentPayload = {
  customContentJson?: string;
  themeOverridesJson?: string;
  rulesJson?: string;
  isSensitive?: boolean;
  eventStartAt?: string;
  eventEndAt?: string;
  eventType?: string;
};

export type UploadResult = {
  uploadId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  missingPhone: number;
  missingEmail: number;
  roleDistribution: Record<string, number>;
  genderDistribution: Record<string, number>;
  warnings: string[];
  errors: string[];
  canContinue: boolean;
};

export type VenuePayload = {
  venueType?: string;
  venueName?: string;
  address?: string;
  city?: string;
  mapLink?: string;
  arrivalInstructions?: string;
};

export type InviterPayload = {
  name?: string;
  phone?: string;
  email?: string;
  organization?: string;
};

export type DeliverySettings = {
  channels: string[];
  fallbackChannel: string | null;
  messageTemplate: string;
};

export type GuestPayload = {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  gender?: string;
};

export type DashboardGuest = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  rsvp?: string | null;
  viewedAt?: string | null;
  /** Channel of the latest delivery attempt ("viber" / "email"). */
  deliveryChannel?: string | null;
};

export type DashboardReport = {
  campaignId?: string;
  title?: string;
  status?: string;
  total: number;
  sent: number;
  failed: number;
  viewed: number;
  /** Guests with no deliverable contact (no phone for Viber and no email). */
  notSent?: number;
  rsvpYes?: number;
  rsvpMaybe?: number;
  rsvpNo?: number;
  rsvpPending?: number;
  guests: DashboardGuest[];
};

/** Raw nested shape returned by GET /api/dashboard/{id} before it is flattened. */
export type DashboardApiResponse = {
  campaign?: { id?: string; title?: string; status?: string };
  report?: {
    total?: number;
    sent?: number;
    failed?: number;
    viewed?: number;
    notSent?: number;
    rsvp?: { going?: number; maybe?: number; notGoing?: number };
  };
  guests?: Array<{
    id: string;
    name: string;
    email?: string | null;
    phoneE164?: string | null;
    inviteStatus?: string;
    rsvpStatus?: string;
    viewedAt?: string | null;
    deliveryChannel?: string | null;
  }>;
};

/** Non-secret campaign context persisted alongside the access token. */
export type CampaignMeta = {
  packageUrl?: string;
  templateName?: string;
  title?: string;
};

/* Admin */
export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

export type AdminLoginResponse = {
  token: string;
  expiresAt: string;
  user: AdminUser;
};

export type TemplateUploadResult = {
  id: string;
  slug: string;
  version: string;
  packageUrl: string;
  variables: string[];
  contentBlocks: string[];
};

/** One guest role and the template content blocks (dress code, message, …) it unlocks. */
export type RoleDefinition = {
  name: string;
  contentBlocks: string[];
};

/** Campaign builder summary (subset the wizard needs — includes roles + the template manifest). */
export type CampaignSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  eventType: string;
  eventStartAt: string;
  eventEndAt: string | null;
  customContentJson: string;
  themeOverridesJson: string;
  rulesJson: string;
  rolesJson: string;
  deliverySettingsJson: string;
  guestCount: number;
  template: {
    name: string;
    slug: string;
    packageUrl: string;
    manifestJson: string;
  } | null;
};

/** OTP request result — the challenge to verify against. */
export type OtpChallenge = {
  challengeId: string;
  expiresInSeconds: number;
};

/** OTP verify result — the invitee/requester access + refresh tokens. */
export type OtpTokens = {
  accessToken: string;
  refreshToken: string;
};

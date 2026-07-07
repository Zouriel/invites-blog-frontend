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

export type CreateCampaignResponse = {
  campaignId: string;
  status: string;
  accessToken: string;
};

export type Pricing = {
  inviteCount: number;
  includedInvites: number;
  extraInvites: number;
  extraBlocks: number;
  blockSize: number;
  minimumPrice: number;
  extraCost: number;
  total: number;
  hasDesignerDiscount?: boolean;
  currency: string;
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
  name?: string;
  address?: string;
  city?: string;
  mapUrl?: string;
  notes?: string;
};

export type InviterPayload = {
  name?: string;
  phone?: string;
  email?: string;
  organization?: string;
};

export type DeliverySettings = {
  channels: string[];
  fallbackChannel: string;
  messageTemplate: string;
};

export type CheckoutResponse = {
  checkoutUrl: string;
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
};

export type DashboardReport = {
  campaignId?: string;
  title?: string;
  status?: string;
  total: number;
  sent: number;
  failed: number;
  viewed: number;
  rsvpYes?: number;
  rsvpNo?: number;
  rsvpPending?: number;
  guests: DashboardGuest[];
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

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
  /** The designer they asked for, if any — otherwise the request goes to the invites.blog team. */
  requestedDesignerUserId?: string | null;
};

/** A designer a customer can ask for by name. Public, so it carries no contact details. */
export type PublicDesigner = {
  userId: string;
  displayName: string;
  publishedTemplates: number;
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
  /** The designer the CUSTOMER asked for on the request form, if any. */
  requestedDesignerUserId: string | null;
  requestedDesignerName: string | null;
  /** Set once the request has been handed to a designer at an agreed price (§commissions). */
  assignedDesignerUserId: string | null;
  assignedDesignerName: string | null;
  commissionPrice: number | null;
  usagePrice: number | null;
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
  /** True when the slot is a GALLERY — the inviter manages an ordered list of photos for it. */
  multiple?: boolean;
  minImages?: number;
  maxImages?: number;
  /** Set when the slot belongs to one role; absent means every role shares it. */
  roleScope?: string;
};

/** One fillable text/link field on a template (a `data-var`/`data-href` path + label + widget type). */
export type TemplateFieldSlot = {
  key: string;
  label: string;
  /** text | textarea | date | time | url | color | select | image */
  type: string;
  /** The allowed values, for `type: 'select'`. */
  options?: string[];
  roleScope?: string;
};

/** One themable CSS custom property the template declares. */
export type TemplateThemeKey = {
  key: string;
  cssVar: string;
  label: string;
  /** color | font | text */
  type: string;
  default: string;
};

/** The template's declared theming surface. */
export type TemplateTheme = {
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fonts?: string[];
  keys?: TemplateThemeKey[];
};

/** One role the template supports, with what is scoped to it. */
export type TemplateRoleDefinition = {
  slug: string;
  label: string;
  themeKeys?: string[];
  fields?: string[];
  imageSlots?: string[];
};

/** The parts of a template manifest the builder reads. */
export type TemplateManifest = {
  variables?: string[];
  contentBlocks?: string[];
  imageSlots?: TemplateImageSlot[];
  fields?: TemplateFieldSlot[];
  roles?: string[];
  roleDefinitions?: TemplateRoleDefinition[];
  theme?: TemplateTheme;
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
  fields?: Record<string, ScopedValue | string>;
  /** Inviter-selected images, keyed by the template slot's `data-src` path. */
  imageSlots?: Record<string, ScopedValue | string>;
  /**
   * The campaign's cover photo — what it looks like in a LIST. Deliberately not one of the
   * `imageSlots` above: no template declares or renders it, and putting it there would hand the
   * binder a key the manifest has never heard of.
   */
  coverImageUrl?: string;
};

/**
 * A value plus which roles it applies to. An empty (or absent) `roles` means every role — which is
 * also what a bare value means, the shape saved before per-role scoping existed.
 */
export type ScopedValue = {
  /** A gallery slot holds a list; everything else holds one string. */
  value: string | string[];
  roles?: string[];
};

/**
 * Role-keyed theme overrides stored on the campaign. `shared` is what every role gets; a role's own
 * entry layers on top of it at render time.
 */
export type ThemeOverrides = {
  shared?: Record<string, string>;
  roles?: Record<string, Record<string, string>>;
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
  /** Dashboard-only: send this guest their invite immediately (default) vs add them for a later,
   * explicit send. Ignored everywhere else — there's nothing to send yet before checkout. */
  sendNow?: boolean;
};

export type DashboardGuest = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  /** Which of the campaign's roles they hold — what a role-aware template personalises on. */
  role?: string | null;
  status?: string;
  rsvp?: string | null;
  viewedAt?: string | null;
  /** Channel of the latest delivery attempt ("viber" / "email"). */
  deliveryChannel?: string | null;
  /** Their answers to the host's RSVP questions, keyed by question. */
  rsvpAnswers?: Record<string, string> | null;
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
  /** The host's chosen cover — what this invitation looks like in a list. */
  coverImageUrl?: string | null;
  /** What it falls back to without one: the template's poster, which carries its demo names. */
  templatePreviewImageUrl?: string | null;
  /** What was asked, so answers can be shown under the right headings. */
  rsvpQuestions?: RsvpQuestion[];
  /** This campaign's configured role names, for the Add-guest role picker. */
  roles: string[];
  /** False for an event that is a media bucket and nothing else — there is no invitation to send. */
  hasInvitation?: boolean;
};

/** Raw nested shape returned by GET /api/dashboard/{id} before it is flattened. */
export type DashboardApiResponse = {
  campaign?: {
    id?: string;
    title?: string;
    status?: string;
    rolesJson?: string;
    coverImageUrl?: string | null;
    templatePreviewImageUrl?: string | null;
    hasInvitation?: boolean;
  };
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
    role?: string | null;
    inviteStatus?: string;
    rsvpStatus?: string;
    viewedAt?: string | null;
    deliveryChannel?: string | null;
    rsvpAnswers?: Record<string, string> | null;
  }>;
  rsvpQuestions?: RsvpQuestion[];
};

/** Non-secret campaign context persisted alongside the access token. */
export type CampaignMeta = {
  packageUrl?: string;
  templateName?: string;
  title?: string;
};

/* Admin */
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
    /** The template's marketing poster — the builder shows it only as the no-cover fallback. */
    previewImageUrl: string | null;
  } | null;
};

/* ---------- Community templates: designer accounts + submissions ---------- */

/** The signed-in designer. */
export type Designer = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  linkedProviders: string[];
};

/** An OAuth provider the server has credentials for — enough for the client to start the dance. */
export type ExternalAuthProvider = {
  provider: 'google' | 'microsoft';
  clientId: string;
  authorizeUrl: string;
};


/** One of the designer's submissions, in whatever review state it's in. */
export type DesignerTemplate = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  status: string;
  rejectionReason: string | null;
  previewImageUrl: string | null;
  packageUrl: string | null;
  manifestJson: string;
  publishedTemplateId: string | null;
  commissionPrice: number | null;
  usagePrice: number | null;
  requestedByEmail: string | null;
  requesterConsentToPublish: boolean;
  designerConsentToPublish: boolean;
  createdAt: string;
  updatedAt: string;
  /** The published template's visibility ("Public" | "Dedicated"), or null while unpublished. */
  publishedVisibility: string | null;
};

/** A submission in the admin review queue — adds who sent it and the raw source. */
export type TemplateSubmission = {
  template: DesignerTemplate;
  designerUserId: string;
  designerEmail: string;
  designerName: string;
  html: string;
};

/** The dry-run scan result shown on the submission form before committing. */
export type TemplateScanResult = {
  passed: boolean;
  errorCode: string | null;
  error: string | null;
  bytes: number;
  recommendedBytes: number;
  maxBytes: number;
  overRecommendedBudget: boolean;
  fields: string[];
  imageSlots: string[];
  roles: string[];
  themeKeys: string[];
};

/** A designer as the admin list shows them. */
export type AdminDesigner = {
  userId: string;
  /** Null for an account that only ever signed in with a phone number. */
  email: string | null;
  displayName: string;
  isActive: boolean;
  linkedProviders: string[];
  publishedTemplates: number;
  pendingSubmissions: number;
  joinedAt: string;
};

/** The per-template split behind a designer's usage-fee total. */
export type DesignerTemplateEarnings = {
  templateId: string;
  name: string;
  slug: string;
  usagePrice: number | null;
  campaigns: number;
  total: number;
};

/** One designer's earnings — commissions plus accrued per-use fees. */
export type DesignerEarnings = {
  userId: string;
  email: string | null;
  displayName: string;
  commissionTotal: number;
  commissionCount: number;
  usageFeeTotal: number;
  usageFeeCampaigns: number;
  total: number;
  byTemplate: DesignerTemplateEarnings[];
};

/** A commission an admin handed to the signed-in designer. */
export type DesignerCommission = {
  inquiryId: string;
  requesterName: string;
  requesterEmail: string;
  occasion: string;
  brief: string;
  colors: string | null;
  references: string | null;
  notes: string | null;
  commissionPrice: number | null;
  usagePrice: number | null;
  templateIssued: boolean;
  createdAt: string;
  /** True once an admin actually handed it over — until then it's only a request. */
  assigned: boolean;
  /** The customer asked for this designer by name. */
  requestedMe: boolean;
};

/** The release state of a commissioned template — who has agreed to make it public. */
export type TemplateRelease = {
  templateId: string;
  name: string;
  slug: string;
  previewImageUrl: string | null;
  visibility: string;
  requestedByEmail: string | null;
  designerName: string | null;
  usagePrice: number | null;
  requesterConsentToPublish: boolean;
  designerConsentToPublish: boolean;
  isPublic: boolean;
};

/* ---------- Unified accounts: one sign-in, roles decide the rest ---------- */

/** The signed-in account. Reachable by email, phone, or both. */
export type Account = {
  id: string;
  email: string | null;
  phoneE164: string | null;
  displayName: string;
  isActive: boolean;
  hasPassword: boolean;
  roles: string[];
  linkedProviders: string[];
  /** 'light' or 'dark', or null to take the default. Follows the account, not the browser. */
  themePreference?: string | null;
};

export type AuthResult = { token: string; expiresAt: string; account: Account };

/** Where a sign-in code went, masked. */
export type CodeSent = {
  challengeId: string;
  channel: 'sms' | 'email';
  sentTo: string;
  expiresInSeconds: number;
};

/** What the sign-in page can honestly offer right now. */
export type AuthOptions = { smsAvailable: boolean; oAuthProviders: ExternalAuthProvider[] };

/** Creating a designer account — the one self-service sign-up on the platform. */
export type RegisterDesignerBody = { email: string; password: string; displayName: string };

/* --- Admin settings: the RBAC and audit surface --- */

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  isActive: boolean;
  roles: string[];
};

export type AdminRole = {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
};

export type AdminPermission = { id: string; name: string; group: string; description: string };

export type AuditEntry = {
  id: string;
  action: string;
  actor: string | null;
  campaignId: string | null;
  dataJson: string;
  createdAt: string;
};

/** A suppressed contact. Stored hashed — we never keep the address that opted out. */
export type SuppressionEntry = {
  id: string;
  contactHash: string;
  contactType: string;
  createdAt: string;
};

/**
 * Result of linking a second identifier — `merged` when another account was absorbed. It carries a
 * fresh token because a merge can grant roles the current token predates.
 */
export type LinkResult = {
  account: Account;
  merged: boolean;
  mergeSummary: string | null;
  token: string;
  expiresAt: string;
};

/** One invitation in the customer's history. */
export type MyCampaign = {
  id: string;
  title: string;
  slug: string;
  status: string;
  eventType: string;
  eventStartAt: string;
  guestCount: number;
  templateName: string | null;
  createdAt: string;
  /** The template's preview — what the invitation LOOKS like, which is how the grid identifies it. */
  previewImageUrl: string | null;
  /** Live photos in this event's box, for the count on the tile. */
  photoCount: number;
  /** True for an event with a media bucket and no invitation — the list has to say which. */
  mediaOnly: boolean;
};

/** One bespoke-template request in the customer's history. */
export type MyRequest = {
  id: string;
  occasion: string;
  message: string;
  hasAttended: boolean;
  templateIssued: boolean;
  issuedTemplateId: string | null;
  issuedTemplateSlug: string | null;
  createdAt: string;
};

/** An invitation this person RECEIVED, shown in their account inbox. */
export type MyInvite = {
  inviteId: string;
  /** The campaign the invitation belongs to — how the app opens it (`/invitation/:campaignId`). */
  campaignId: string;
  eventTitle: string;
  eventDate: string;
  venueType: string;
  rsvpStatus: string;
  isNew: boolean;
  isPast: boolean;
  cancelled: boolean;
  inviterName: string | null;
  /** The template's preview — what the invitation LOOKS like, which is how the grid identifies it. */
  previewImageUrl: string | null;
  /** Live photos in this event's box, for the count on the tile. */
  photoCount: number;
};

/** One row of the templates table (System templates for admin, My templates for a designer). */
export type MyTemplateRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  version: string;
  visibility: string;
  isActive: boolean;
  previewImageUrl: string | null;
  designerName: string | null;
  designerUserId: string | null;
  usagePrice: number | null;
  commissionPrice: number | null;
  campaignCount: number;
  canEditDirectly: boolean;
  pendingReview: boolean;
  updatedAt: string;
};

export type MyTemplatesPage = {
  scope: 'system' | 'mine';
  title: string;
  templates: MyTemplateRow[];
};

export type DeleteTemplateOutcome = {
  deleted: boolean;
  unlisted: boolean;
  campaignCount: number;
  message: string;
};

/** One thing the RSVP form asks. Keys are what answers are filed under, so the server assigns them. */
export type RsvpQuestion = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'yesno';
  required?: boolean;
  askIfNotGoing?: boolean;
  options?: string[];
};

/** One photo in an event's box (§5). */
export type EventPhoto = {
  id: string;
  /** Viewing size — what a tap opens, and what a download hands over. */
  url: string;
  /** Grid size. The only thing the photo grid itself should ever load. */
  thumbUrl: string;
  /**
   * The shot as taken. Nothing renders this — it is what a download hands over. For a video it is
   * the same object as `url`: there is no smaller viewing copy without transcoding.
   */
  originalUrl: string;
  /**
   * What this actually is, so a video can be told from a photograph without guessing at the file
   * extension. `thumbUrl` is a still either way; for a video it is the poster frame.
   */
  contentType: string;
  width: number;
  height: number;
  uploaderName: string | null;
  /**
   * Resolved by the server for THIS caller — a guest may remove their own, a host may remove any.
   * Never re-derive it in the browser.
   */
  canDelete: boolean;
  createdAt: string;
};

/** An event's photo box as the current caller sees it. */
export type EventPhotoBox = {
  campaignId: string;
  eventTitle: string;
  count: number;
  canUpload: boolean;
  photos: EventPhoto[];
  /** Why adding is off, when it is — the server's own sentence. Absent while it is on. */
  closedNote?: string | null;
};

/* Media buckets (§5) — where a night's photographs and clips live, and what we sell. */

/** One size of bucket as it is offered. */
export type MediaBucketPlan = {
  /** The stored value ('Gb10' … 'Gb50'), not the label. */
  tier: string;
  gb: number;
  price: number;
  currency: string;
  termMonths: number;
  /** True for the size this bucket is already on. */
  isCurrent: boolean;
};

/** A bucket as its owner sees it in a list. Deliberately not its contents. */
export type MediaBucket = {
  id: string;
  title: string;
  coverUrl: string | null;
  tier: string;
  gb: number;
  capacityBytes: number;
  usedBytes: number;
  /** 0–100, rounded by the server so every surface draws the same bar from the same number. */
  percentUsed: number;
  itemCount: number;
  /** The event it collects for, when it has one. Null is a standalone bucket, not a broken one. */
  campaignId: string | null;
  campaignTitle: string | null;
  /** The night it is for. What decides when it is open. */
  eventDate: string;
  /** Whether anything may be added right now — the same window that offers the camera on an invite. */
  isOpen: boolean;
  termEndAt: string | null;
  expired: boolean;
  createdAt: string;
};

/**
 * A contribution code.
 *
 * `url` is the scannable link and arrives ONLY in the response that created the code — the token
 * behind it is stored hashed. `imageUrl` is always there, which is what lets the dashboard keep the
 * last code on show without the secret being re-readable.
 */
export type MediaBucketQr = {
  id: string;
  url: string | null;
  imageUrl: string;
  label: string | null;
  allowAnonymous: boolean;
  tokenHint: string;
  scanCount: number;
  uploadCount: number;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

/** What a scanned code opens, as the contributor page sees it. */
export type BucketScan = {
  bucketTitle: string;
  /** Whether a name alone is enough, or a contact has to be verified first. */
  allowAnonymous: boolean;
  /** The night is open AND there is room. The page hides its picker entirely on this. */
  canUpload: boolean;
  /** Whether it is the night, separately, so the page can say WHICH reason it can't take anything. */
  isOpen: boolean;
  eventDate: string;
};

/** What a contributor carries for the rest of their session once admitted. */
export type BucketAdmission = { ticket: string; displayName: string };

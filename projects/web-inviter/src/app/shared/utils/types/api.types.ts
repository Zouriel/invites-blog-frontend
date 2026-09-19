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
  createdAt: string;
};
export type UpdateInquiryBody = {
  colors: string | null;
  references: string | null;
  notes: string | null;
  hasAttended: boolean;
};

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
  /** The gallery poster; null when there's none (the card shows the live page instead). */
  previewImageUrl: string | null;
  /** Who published it; null for the platform's own templates. */
  designerName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when an admin took it out of the gallery; its creator can't list it again until it's put back. */
  unlistedByAdminAt: string | null;
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
/**
 * What invites.blog may still email for an event: the plan includes some (Free none, Party 100,
 * Wedding 500), admins add more. Each guest counts once; resends are free; sharing links never counts.
 */
export type SendingAllowance = { included: number; extra: number; used: number; total: number; left: number };

export type FinalizeResult = {
  shareLink: string;
  guestCount: number;
  emailed: number;
  /** Guests not emailed because the event's emailed invitations were used up. */
  notEmailed?: number;
  sending?: SendingAllowance | null;
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

/** One problem with an uploaded spreadsheet row (the server's `GuestUploadError`). */
export type UploadRowError = {
  /** The Excel row number, as the host sees it in their spreadsheet. */
  row: number;
  field: string;
  message: string;
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
  errors: UploadRowError[];
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
  /** Every role the guest holds. Sent instead of `role` by the screens that pick several. */
  roles?: string[];
  gender?: string;
  /** Dashboard-only: send this guest their invite immediately (default) vs add them for a later,
   * explicit send. Ignored everywhere else — there's nothing to send yet before checkout. */
  sendNow?: boolean;
};

export type DashboardGuest = {
  id: string;
  /** Every role, first one first. Rows from before guests could hold several have just `role`. */
  roles: string[];
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
  /** What invites.blog may still email for this event. */
  sending?: SendingAllowance | null;
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
  /**
   * The open link — one address anybody may follow — or null when this event has none. Only ever
   * set for a design the customer brought; see the Guests step, which is where it is switched on.
   */
  openLink?: string | null;
  /**
   * Whether the customer brought this design themselves. The open link is offered only for one —
   * a gallery template personalises per guest, and an anonymous viewer is not a guest.
   */
  isImported?: boolean;
  /**
   * Whether this event is an unfinished draft — a design uploaded, or a template chosen, but never
   * sent. NOT the same as having no invitation: a package URL is written the moment artwork is
   * uploaded, so an import that stalls three steps from the end still reports hasInvitation true.
   */
  isDraft?: boolean;
  /** The wizard step to continue from when the invitation isn't finished. */
  resumeStep?: string | null;
  /**
   * Who is looking. A read-only celebrant sees names and replies and changes nothing; a manager is
   * a celebrant the organiser gave full access.
   */
  viewer: DashboardViewer;
};

export type DashboardViewer = 'organiser' | 'manager' | 'celebrant';

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
    openLink?: string | null;
    isImported?: boolean;
    isDraft?: boolean;
    /** The wizard step to continue from when the invitation isn't finished. */
    resumeStep?: string | null;
    viewer?: DashboardViewer;
  };
  /** What invites.blog may still email for this event. */
  sending?: SendingAllowance | null;
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
    roles?: string[] | null;
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

/** One guest role and the template content blocks (dress code, message, …) it unlocks. */
export type RoleDefinition = {
  name: string;
  contentBlocks: string[];
  /** Dress colours for guests with this role, as #rrggbb. Empty or absent when none were set. */
  palette?: string[];
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
  /**
   * Whether the customer brought this design themselves rather than taking one from the gallery.
   * What the builder branches on: an imported design declares no fields, so the steps that fill
   * fields are skipped, and Venue and RSVP go with them because their answers have nowhere to
   * appear on finished artwork.
   */
  isImported: boolean;
  /**
   * The event's open link — one address anybody may follow — or null when it has none. The whole
   * URL rather than a flag, because the host needs to copy it again tomorrow.
   */
  openLink: string | null;
  /** What was saved on the Inviter step, so it shows again. */
  inviterName?: string | null;
  inviterEmail?: string | null;
  inviterPhone?: string | null;
  inviterOrganization?: string | null;
  /** What invites.blog may still email for this event. */
  sending?: SendingAllowance | null;
};

/* ---------- Sign-in ---------- */

/** An OAuth provider the server has credentials for — enough for the client to start the dance. */
export type ExternalAuthProvider = {
  provider: 'google' | 'microsoft';
  clientId: string;
  authorizeUrl: string;
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
  joinedAt: string;
  /** Whether their Studio plan is in force, and when it ends. */
  studioActive: boolean;
  studioEndsAt: string | null;
  /** Passes they hold to give clients. */
  passCredits: number;
  /** Templates they published for one person: their clients. */
  clientTemplates: number;
  partyCredits: number;
  weddingCredits: number;
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
  /** The professional plan in force right now: Studio or Venue, or None. */
  subscriptionTier?: SubscriptionTier;
  subscriptionEndsAt?: string | null;
  /** Owns a venue or is on a venue's staff, so the venue's page is theirs to open. */
  atVenue?: boolean;
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

/** Creating a designer account. */
export type RegisterDesignerBody = { email: string; password: string; displayName: string };

/* --- Admin settings: the RBAC and audit surface --- */

/** An account's professional plan. Hosts buy a pass per event instead. */
export type SubscriptionTier = 'None' | 'Studio' | 'Venue';

/** A pass bought for one event. */
export type EventPassKind = 'None' | 'Party' | 'Wedding';

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  isActive: boolean;
  roles: string[];
  /** As set, even after it has ended; see `subscriptionActive`. */
  subscriptionTier: SubscriptionTier;
  subscriptionEndsAt: string | null;
  subscriptionActive: boolean;
  /** Passes a Studio account holds and hasn't given to a client yet, and of which kind. */
  passCredits: number;
  partyCredits: number;
  weddingCredits: number;
};

/** An event an account organised, with its pass and how long its photos are kept. */
export type AdminUserEvent = {
  id: string;
  title: string;
  eventStartAt: string;
  pass: EventPassKind;
  eventPassUntil: string | null;
  passActive: boolean;
  keepPhotosUntil: string | null;
  /** What covers it now, when its photos start to lapse, and where they are in that. */
  plan: PlanKind;
  coveredUntil: string | null;
  phase: MediaPhase;
  sending: SendingAllowance | null;
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
  /** The wizard step to continue from when the invitation isn't finished; null when it is. */
  resumeStep?: string | null;
  /** 'host' for your own events, 'celebrant' for an event somebody organised for you. */
  relation?: 'host' | 'celebrant';
  /** For a celebrant: whether the organiser gave them full access. */
  canManage?: boolean;
  /** What the event is on, for its badge. */
  plan?: PlanKind;
};

/** One bespoke-template request in the customer's history. */
export type MyRequest = {
  id: string;
  occasion: string;
  message: string;
  hasAttended: boolean;
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
  campaignCount: number;
  updatedAt: string;
};

/** What the signed-in person published — their own only, admins included. */
export type MyTemplatesPage = {
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
  /** The venue the event is held at: its name and logo head the album. */
  venueName?: string | null;
  venueLogoUrl?: string | null;
};

/* Media buckets (§5) — where a night's photographs and clips live, and what we sell. */

/** Which plan covers an event. A venue outranks a Wedding pass, which outranks a Party pass. */
export type PlanKind = 'Free' | 'PartyPass' | 'WeddingPass' | 'Venue';

/** Where an event's photos are after its plan runs out. */
export type MediaPhase = 'Active' | 'UploadsClosed' | 'OrganiserOnly' | 'Deleted';

/** One plan as the pricing page shows it. Sizes are in bytes, prices in the catalogue's currency (MVR). */
export type Plan = {
  kind: PlanKind | 'Studio';
  name: string;
  price: number;
  /** "every event", "per event", "per month". */
  billing: string;
  yearlyPrice: number | null;
  /** What a Studio account pays for this pass to give a client. */
  studioPrice: number | null;
  /** Null for Studio, which has no event limits of its own. */
  eventBytes: number | null;
  /** A venue's space across all of its events. */
  accountBytes: number | null;
  maxBuckets: number | null;
  maxWindowDays: number | null;
  /** How long photos are kept from the event day; null while a subscription covers them. */
  retentionDays: number | null;
  /** Invitations invites.blog sends for the event without charge. */
  includedInvites: number;
  /** Whether an album can be closed to some guests. */
  privateAlbums: boolean;
  /** Whether the invitation and album carry a small "Made with invites.blog". */
  branded: boolean;
  /** The price is the smallest; larger ones are quoted. */
  from: boolean;
};

/** The space a venue's events share. For anyone who isn't at a venue, `tier` is "None". */
export type StorageSummary = {
  tier: SubscriptionTier;
  accountBytes: number | null;
  usedBytes: number;
  venueName: string | null;
};

export type PlanCatalog = {
  currency: string;
  /** Rufiyaa to the dollar, for the approximate dollar prices shown alongside. */
  mvrPerUsd: number;
  plans: Plan[];
  keepPhotos: { price: number; months: number };
  /** Invitations sent beyond what a pass includes: `perBlock` for every `blockSize`. */
  sending: { perBlock: number; blockSize: number };
  lapse: { reminderDay: number; organiserOnlyDay: number; finalNoticeDay: number; deleteDay: number };
  studioDiscountPercent: number;
};

/** What everything costs, in rufiyaa: the admin price book (Admin → Prices). */
export type Prices = {
  partyPass: number;
  weddingPass: number;
  keepPhotosYearly: number;
  studioMonthly: number;
  studioYearly: number;
  venueMonthlyFrom: number;
  sendingPerBlock: number;
  studioDiscountPercent: number;
  mvrPerUsd: number;
};

/* Studio: a designer's or planner's clients, and the passes they hold to give them. */

export type StudioClient = {
  campaignId: string;
  title: string;
  eventStartAt: string;
  status: string;
  hostName: string | null;
  hostEmail: string | null;
  templateName: string | null;
  guestCount: number;
  going: number;
  /** The pass in force now. */
  pass: EventPassKind;
  passUntil: string | null;
  /** Organised by this account, so its dashboard opens for them. */
  mine: boolean;
};

export type StudioOverview = {
  partyCredits: number;
  weddingCredits: number;
  partyPassPrice: number;
  weddingPassPrice: number;
  clients: StudioClient[];
};

/* Venue: a resort or hall, its staff and its events. */

export type VenueStaff = { id: string; email: string; name: string | null; createdAt: string };

export type VenueEvent = {
  campaignId: string;
  title: string;
  eventStartAt: string;
  albums: number;
  photos: number;
  usedBytes: number;
  /** Whether the event has an invitation, or is albums only. */
  hasInvitation: boolean;
};

export type Venue = {
  id: string;
  name: string;
  place: string | null;
  logoUrl: string | null;
  /** Only the owner changes the venue's name, logo and staff. */
  isOwner: boolean;
  /** Whether the Venue plan is in force. New events need it. */
  planActive: boolean;
  planEndsAt: string | null;
  accountBytes: number;
  usedBytes: number;
  staff: VenueStaff[];
  events: VenueEvent[];
  /** What a couple enters on their own event to hold it at this venue. */
  code: string | null;
};

/** The venue an event is held at, as its host sees it. */
export type EventVenue = { id: string; name: string; place: string | null; logoUrl: string | null; planActive: boolean };

/**
 * Who may look into one bucket: every guest on the event with a switch. While `isRestricted` is
 * false the whole guest list is allowed, including guests added later; the first guest switched off
 * closes it, and from then on new guests start switched off.
 */
export type BucketAccess = {
  bucketId: string;
  isRestricted: boolean;
  guests: { guestId: string; name: string; roles: string[]; allowed: boolean }[];
};

/** Somebody an event is for. Linked to whichever account signs in with this email or phone. */
export type Celebrant = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Full access; otherwise they can only look. */
  canManage: boolean;
  notifiedAt: string | null;
};

export type MediaBucket = {
  id: string;
  /**
   * What the owner calls this bucket — its own, not the event's. "Night's bucket" until renamed.
   * An event may hold several once its owner subscribes, and they would otherwise read identically.
   */
  name: string;
  /** The event's name, shown WITH the bucket's rather than instead of it. */
  title: string;
  coverUrl: string | null;
  /** The event's plan. Every bucket on an event shows the same one. */
  tier: PlanKind;
  /** The event's space in GB, shared by its buckets. */
  gb: number;
  capacityBytes: number;
  usedBytes: number;
  /** 0–100, rounded by the server so every surface draws the same bar from the same number. */
  percentUsed: number;
  itemCount: number;
  /**
   * The event it collects for. Always set — a bucket bought on its own gets a bare campaign, because
   * the campaign is what holds the title, the cover and the guest list.
   */
  campaignId: string;
  campaignTitle: string | null;
  /** The night it is for. What decides when it is open. */
  eventDate: string;
  /** Whether anything may be added right now — the same window that offers the camera on an invite. */
  isOpen: boolean;
  /** How many days it collects for, counted from when the event begins. 1 is the ordinary night. */
  windowDays: number;
  /**
   * Whether this is the event's first bucket — the one the invitation's camera and the dashboard
   * post to. An event can have several with a pass; only one of them is this.
   */
  isDefault: boolean;
  /** When the event's plan ends; null while a venue's plan covers it. */
  termEndAt: string | null;
  /** True once the plan has ended: nothing new can be added. */
  expired: boolean;
  /** How many buckets the event's plan allows, and how many days one may collect for. */
  maxBuckets: number;
  maxWindowDays: number;
  phase: MediaPhase;
  /** What all of the event's buckets hold together, against the event's space. */
  eventUsedBytes: number;
  /** Whether an album can be closed to some guests (Wedding pass and venues). */
  privateAlbums: boolean;
  /** A Free event: its pages carry a small "Made with invites.blog". */
  branded: boolean;
  /** The venue the event is held at, whose name and logo its albums and QR cards carry. */
  venueName: string | null;
  venueLogoUrl: string | null;
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
  /** A Free event: the page carries a small "Made with invites.blog". */
  branded?: boolean;
  /** The venue the event is at: its name and logo head the page. */
  venueName?: string | null;
  venueLogoUrl?: string | null;
  /** When adding opens and closes: the day before the event, until the day after (or longer with a pass). */
  opensAt?: string | null;
  closesAt?: string | null;
};

/** What a contributor carries for the rest of their session once admitted. */
export type BucketAdmission = { ticket: string; displayName: string };

/** One picture at the top of a post. A video is shown by its still. */
export type FeedImage = { url: string; isVideo: boolean };

/** How the reader is involved in the event a post is about. */
export type FeedRole = 'host' | 'manager' | 'celebrant' | 'guest';

/** An event, told as a post in the home feed of everyone involved in it. */
export type FeedPost = {
  campaignId: string;
  title: string;
  hostName: string | null;
  eventStartAt: string;
  venue: string | null;
  /** The organiser's words, or the invitation's own when they haven't written any. */
  caption: string | null;
  captionIsAuto: boolean;
  images: FeedImage[];
  /** True when the header is the invitation's cover, not photos from the event. */
  imagesAreCover: boolean;
  photoCount: number;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  role: FeedRole;
  canModerate: boolean;
  /** The dashboard for people running it, the invitation for guests. */
  link: string;
  lastActivityAt: string;
};

export type FeedPage = { items: FeedPost[]; hasMore: boolean };

export type FeedComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  authorIsHost: boolean;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  replies: FeedComment[];
};

export type LikeState = { likeCount: number; likedByMe: boolean };

/** The photos picked to head an event's post, from its default bucket. Empty uses the first photos. */
export type FeedCovers = { bucketId: string | null; photoIds: string[]; max: number };

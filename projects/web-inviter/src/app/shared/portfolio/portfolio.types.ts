/**
 * The Studio portfolio's shapes, as the API sends them (docs/PORTFOLIO.md; full list in the umbrella's
 * docs/PORTFOLIO-HANDOFF.md). Every change to a portfolio answers with the whole Portfolio again.
 */
export type PortfolioSectionKind = 'cover' | 'collection' | 'about' | 'designs' | 'packages' | 'reviews' | 'contact';
export type PortfolioLayout = 'grid' | 'masonry' | 'slideshow';

export type PortfolioContact = {
  whatsApp: string | null;
  viber: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  enquiries: boolean;
};

export type PortfolioPackage = { name: string; price: string | null; lines: string[] | null };
export type PortfolioReview = { quote: string; name: string | null };

export type PortfolioPhoto = {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  campaignId: string | null;
  sourcePhotoId: string | null;
};

export type PortfolioCollection = {
  id: string;
  title: string;
  layout: PortfolioLayout;
  coverPhotoId: string | null;
  coverUrl: string | null;
  photos: PortfolioPhoto[];
};

export type PortfolioSection = {
  id: string;
  kind: PortfolioSectionKind;
  hidden: boolean;
  locked: boolean;
  collectionId: string | null;
  title: string | null;
  body: string | null;
  photoId: string | null;
  photoUrl: string | null;
  templateIds: string[];
  packages: PortfolioPackage[];
  reviews: PortfolioReview[];
};

export type Portfolio = {
  id: string;
  handle: string | null;
  publicUrl: string | null;
  displayName: string;
  tagline: string | null;
  logoUrl: string | null;
  /** A cover picture uploaded for the page (wins over a chosen photo); null when none. */
  coverImageUrl?: string | null;
  /** Where coverUrl comes from. */
  coverSource?: 'upload' | 'photo' | 'auto' | 'none';
  coverPhotoId: string | null;
  coverUrl: string | null;
  theme: string;
  accent: string;
  font: string;
  contact: PortfolioContact;
  published: boolean;
  publishedAt: string | null;
  setupDone: boolean;
  photoCount: number;
  photoLimit: number;
  unreadEnquiries: number;
  sections: PortfolioSection[];
  collections: PortfolioCollection[];
};

export type PortfolioUpdate = Partial<{
  displayName: string;
  tagline: string;
  theme: string;
  accent: string;
  font: string;
  coverPhotoId: string;
  clearCover: boolean;
  contact: Partial<{ whatsApp: string; viber: string; instagram: string; phone: string; email: string; enquiries: boolean }>;
  setupDone: boolean;
}>;

export type PortfolioSectionBody = Partial<{
  kind: PortfolioSectionKind;
  hidden: boolean;
  title: string;
  body: string;
  photoId: string;
  clearPhoto: boolean;
  templateIds: string[];
  packages: PortfolioPackage[];
  reviews: PortfolioReview[];
}>;

export type HandleCheck = {
  handle: string;
  available: boolean;
  reason: 'ok' | 'yours' | 'invalid' | 'reserved' | 'taken';
  message: string;
  suggestion: string | null;
};

export type AddPortfolioPhotosResult = {
  added: number;
  alreadyIn: number;
  skippedGuest: number;
  skippedVideo: number;
  skippedOther?: number;
  skippedMissing?: number;
  skipped?: { photoId: string; reason: PortfolioSkipReason }[];
  collectionId: string;
  message: string;
  portfolio: Portfolio;
};

/** Why an album photo can't go in the portfolio. */
export type PortfolioSkipReason = 'guest' | 'other_account' | 'video' | 'missing';

/** GET /api/me/campaigns/{id}/portfolio-photos: the album as the portfolio picker sees it. */
export type PortfolioEventPhoto = {
  id: string;
  thumbUrl: string;
  url: string;
  width: number;
  height: number;
  eligible: boolean;
  reason: PortfolioSkipReason | null;
  reasonText: string | null;
  inPortfolio: boolean;
};

export type PortfolioEventPhotos = {
  consented: boolean;
  eligibleCount: number;
  guestCount: number;
  videoCount: number;
  photos: PortfolioEventPhoto[];
};

export type PortfolioConsent = { consented: boolean; consentedAt: string | null; photosInPortfolio: number };

/** One person who added photos to an event without an account ("These are mine", handoff "Fix 2026-11-13 night"). */
export type PortfolioUploaderGroup = {
  /** Pass back as-is to claim or unclaim. */
  key: string;
  name: string;
  photoCount: number;
  videoCount: number;
  /** Up to 4, site-relative. */
  thumbUrls: string[];
  claimed: boolean;
  claimedAt: string | null;
};

export type PortfolioUploaders = { consented: boolean; groups: PortfolioUploaderGroup[] };

export type PortfolioClaimResult = { count: number; message: string; uploaders: PortfolioUploaders; removedFromPortfolio?: number };

export type PortfolioEnquiry = {
  id: string;
  name: string;
  contact: string;
  eventDate: string | null;
  message: string;
  createdAt: string;
  read: boolean;
};

export type PortfolioDesign = { id: string; name: string; previewUrl: string | null };

export type PortfolioThemeChoice = {
  key: string;
  label: string;
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
};

export type PortfolioOptions = {
  themes: PortfolioThemeChoice[];
  accents: { key: string; label: string; color: string | null }[];
  fonts: { key: string; label: string; heading: string; body: string; sample: string }[];
  layouts: { key: PortfolioLayout; label: string }[];
  sectionKinds: { kind: PortfolioSectionKind; label: string; multiple: boolean }[];
};

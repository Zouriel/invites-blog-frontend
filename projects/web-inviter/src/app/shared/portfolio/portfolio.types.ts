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
  collectionId: string;
  message: string;
  portfolio: Portfolio;
};

export type PortfolioConsent = { consented: boolean; consentedAt: string | null; photosInPortfolio: number };

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

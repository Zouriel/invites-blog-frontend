/**
 * The account's guidance state (docs/GUIDANCE.md section 2), as GET /api/me/guidance answers it.
 * Shared with the Flutter app: never rename a field on one side only.
 */
export type GuidanceProgress = {
  hasName: boolean;
  hasPhoto: boolean;
  hasEvent: boolean;
  hasGuests: boolean;
  hasSent: boolean;
  hasPhotoInAlbum: boolean;
  hasDesign: boolean;
};

/** An event where this account was made a celebrant and hasn't opened it yet. */
export type GuidanceNewRole = {
  campaignId: string;
  title: string;
  coverUrl: string | null;
  access: 'look' | 'full';
  addedBy: string | null;
  addedAt: string;
};

export type GuidanceState = {
  tipsOn: boolean;
  seen: string[];
  welcomeUntil: string | null;
  progress: GuidanceProgress;
  newRoles: GuidanceNewRole[];
};

export const NO_PROGRESS: GuidanceProgress = {
  hasName: false,
  hasPhoto: false,
  hasEvent: false,
  hasGuests: false,
  hasSent: false,
  hasPhotoInAlbum: false,
  hasDesign: false,
};

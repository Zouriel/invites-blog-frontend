/**
 * The designer's scene, mirroring `InvitesBlog.TemplateCompiler.Design.DesignScene` on the server.
 * The server is the only compiler: the editor edits this JSON and asks the API to render it.
 *
 * Units are canvas units on a 390-wide phone page. Tracks are scroll offsets in the same units,
 * from 0 to the page's scroll range (page height minus the 844-tall reference screen).
 */

export const CANVAS_WIDTH = 390;
export const REFERENCE_VIEWPORT = 844;

export type ElementType = 'text' | 'shape' | 'svg' | 'image' | 'slot' | 'rsvp' | 'link' | 'dress' | 'group';

export interface DesignScene {
  schema: 2;
  canvas: { sections: DesignSection[] };
  theme: ThemeEntry[];
  fonts: string[];
  roles: string[];
  fields: CustomField[];
  elements: DesignElement[];
  assets: Record<string, DesignAsset>;
}

export interface DesignSection {
  id: string;
  name: string;
  height: number;
  /** `theme:{key}`, a hex colour, or null for the page background. */
  background?: string | null;
}

export interface ThemeEntry {
  key: string;
  label: string;
  /** A hex colour, or a font id for a key containing "font". */
  value: string;
}

export interface CustomField {
  path: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'time' | 'url' | 'color' | 'select';
  options?: string[] | null;
  roleScope?: string | null;
  sample?: string | null;
}

export interface DesignAsset {
  kind: 'svg' | 'image';
  data: string;
  width: number;
  height: number;
  colors?: string[] | null;
  name?: string | null;
}

export interface DesignTrack {
  start: number;
  end: number;
}

export interface DesignKeyframe {
  t: number;
  x?: number | null;
  y?: number | null;
  rotate?: number | null;
  scale?: number | null;
  opacity?: number | null;
  /** How far in front of its neighbours it comes at this keyframe, 0–99. */
  lift?: number | null;
  easing?: string | null;
  preset?: 'enter' | 'exit' | null;
}

export interface DesignRun {
  text?: string | null;
  var?: string | null;
  bold?: boolean;
  italic?: boolean;
}

export interface Typography {
  font?: string | null;
  size: number;
  weight: number;
  italic?: boolean;
  color?: string | null;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  uppercase?: boolean;
}

export interface DesignElement {
  id: string;
  type: ElementType;
  name?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  scale: number;
  opacity: number;
  track?: DesignTrack | null;
  keyframes: DesignKeyframe[];
  enter?: string | null;
  exit?: string | null;
  pinned?: boolean;
  block?: string | null;
  roleScope?: string | null;
  locked?: boolean;

  text?: { runs: DesignRun[]; style: Typography } | null;
  shape?: {
    kind: 'rect' | 'ellipse' | 'line' | 'polygon' | 'path'; sides: number; fill?: string | null; stroke?: string | null; strokeWidth: number; radius: number;
    /** The outline of a drawn (`path`) shape, from the shape editor. */
    path?: DesignPath | null;
  } | null;
  svg?: { asset: string; fills: Record<string, string> } | null;
  image?: { asset: string; fit: 'cover' | 'contain'; radius: number } | null;
  slot?: { path: string; label: string; fit: 'cover' | 'contain'; radius: number; multiple: boolean; min?: number | null; max?: number | null; columns: number; gap: number; aspect: number;
    /** One photo out of a gallery, 1 being its first. */
    index?: number | null } | null;
  button?: { path?: string | null; label: string; fill?: string | null; stroke?: string | null; strokeWidth: number; radius: number; style: Typography } | null;
  dress?: { swatch: number; shape: 'circle' | 'square'; gap: number; style: Typography } | null;
  children?: DesignElement[] | null;
}

// ----- Catalog (GET /api/designs/catalog) -----

export interface CatalogFont {
  id: string;
  name: string;
  category: 'serif' | 'sans' | 'script' | 'display';
  fallback: string;
  weights: number[];
  stack: string;
}

export interface CatalogVariable {
  path: string;
  label: string;
  group: string;
  kind: 'text' | 'link' | 'image';
  type: string;
  sample: string;
}

export interface PresetFrame {
  t: number;
  dx: number;
  dy: number;
  dRotate: number;
  scale: number;
  opacity: number;
  easing?: string | null;
}

export interface MotionPreset {
  id: string;
  label: string;
  frames: PresetFrame[];
}

export interface DesignCatalog {
  canvas: { width: number; referenceViewport: number };
  fontBaseUrl: string;
  fonts: CatalogFont[];
  variables: CatalogVariable[];
  enterPresets: MotionPreset[];
  exitPresets: MotionPreset[];
  easings: string[];
  fieldTypes: string[];
  linkPaths: string[];
  starters: { id: string; name: string; description: string }[];
  requiredThemeKeys: string[];
  limits: {
    softBytes: number; hardBytes: number; maxSvgBytes: number; maxImageBytes: number; maxElements: number;
    maxKeyframes: number; maxSections: number; minSectionHeight: number; maxSectionHeight: number; maxDepth: number;
    maxSceneBytes: number;
  };
}

// ----- API DTOs -----

export interface DesignIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  elementId?: string | null;
}

export interface TemplateStructure {
  fields: string[];
  imageSlots: string[];
  roles: string[];
  themeKeys: string[];
}

export interface DesignTemplateInfo {
  id: string;
  name: string;
  slug: string;
  version: string;
  visibility: 'Public' | 'Private' | 'Dedicated' | 'Imported';
  isActive: boolean;
  category: string;
  description: string;
  previewImageUrl?: string | null;
  unlistedByAdmin: boolean;
  eventsUsing: number;
  eventsOnOlderVersions: number;
  /** The email a private template was made for; only that person can use it. */
  assignedEmail?: string | null;
}

export interface DesignSummary {
  id: string;
  name: string;
  revision: number;
  publishedRevision?: number | null;
  updatedAt: string;
  lastPublishedAt?: string | null;
  template?: DesignTemplateInfo | null;
}

export interface DesignPublishEntry {
  version: string;
  visibility: string;
  revision: number;
  bytes: number;
  publishedAt: string;
}

export interface DesignDetail {
  id: string;
  name: string;
  scene: DesignScene;
  revision: number;
  publishedRevision?: number | null;
  updatedAt: string;
  campaignId?: string | null;
  template?: DesignTemplateInfo | null;
  history: DesignPublishEntry[];
  publicBlockedReason?: string | null;
  publicPublishesLeftToday: number;
}

export interface DesignPreview {
  html: string;
  bytes: number;
  issues: DesignIssue[];
  structure: TemplateStructure;
  canPublish: boolean;
}

export interface DesignAssetUpload {
  id: string;
  kind: 'svg' | 'image';
  data: string;
  width: number;
  height: number;
  colors?: string[] | null;
  name: string;
  bytes: number;
}

export interface PublishResult {
  design: DesignDetail;
  templateId: string;
  slug: string;
  version: string;
  visibility: string;
  warnings: DesignIssue[];
  attachedCampaignId?: string | null;
}

export interface DesignEvent {
  campaignId: string;
  title: string;
  version: string;
  isLatest: boolean;
  status: string;
  eventStartAt?: string | null;
}

export interface DesignImportSource {
  templateId: string;
  name: string;
  version: string;
  designed: boolean;
  html?: string | null;
  existingDesignId?: string | null;
}

export interface TemplateReport {
  id: string;
  templateId: string;
  templateName: string;
  templateSlug: string;
  templatePreviewUrl?: string | null;
  templateVisibility: string;
  templateActive: boolean;
  designerName?: string | null;
  designerUserId?: string | null;
  reason: string;
  details?: string | null;
  status: 'Open' | 'Resolved';
  resolution?: string | null;
  resolutionNote?: string | null;
  reportsForTemplate: number;
  createdAt: string;
  resolvedAt?: string | null;
}

/** A drawn outline, in a `width` × `height` space stretched onto the element's box. Handles are absolute. */
export interface DesignPath {
  width: number;
  height: number;
  contours: { closed: boolean; points: { x: number; y: number; in?: { x: number; y: number } | null; out?: { x: number; y: number } | null }[] }[];
}

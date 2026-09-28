/**
 * The designer's scene, mirroring `InvitesBlog.TemplateCompiler.Design.DesignScene` on the server.
 * The server is the only compiler: the editor edits this JSON and asks the API to render it.
 *
 * Units are canvas units on a 390-wide phone page. Tracks are scroll offsets in the same units,
 * from 0 to the page's scroll range (page height minus the 844-tall reference screen). There are no
 * screens: the page ends where its lowest element does.
 */

export const CANVAS_WIDTH = 390;
export const REFERENCE_VIEWPORT = 844;

export type ElementType = 'text' | 'shape' | 'svg' | 'image' | 'slot' | 'rsvp' | 'link' | 'dress' | 'group';

export interface DesignScene {
  schema: 3;
  /**
   * Stage mode: things stay where they're put on the screen however far you scroll; only motion moves
   * them, and an element with a bar shows only during it. Off: the page scrolls, as designs made before
   * 2026-09-28 do.
   */
  stage?: boolean;
  /** How far the page scrolls at least (canvas units), set by dragging the timeline's End. Null: its content. */
  length?: number | null;
  /** 'saveTheDate' for a save the date (no reply button needed; the server adds Add to calendar). */
  kind?: 'invitation' | 'saveTheDate' | null;
  /** Schema 2 kept its screens here; they're converted on load (see `upgradeScene`). */
  canvas: { sections?: DesignSection[] | null };
  theme: ThemeEntry[];
  fonts: string[];
  roles: string[];
  fields: CustomField[];
  elements: DesignElement[];
  assets: Record<string, DesignAsset>;
}

/** Schema 2's screen — only read, to convert an older design. */
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
  /** 3D turn about the horizontal axis, degrees. */
  rotateX?: number | null;
  /** 3D turn about the vertical axis, degrees. */
  rotateY?: number | null;
  skewX?: number | null;
  skewY?: number | null;
  /** Blur in canvas units, 0–40. */
  blur?: number | null;
  /** Percent cut away — inset: top, right, bottom, left; circle: radius. Shape from the element's clipShape. */
  clip?: number[] | null;
  /** How much of a shape's outline is drawn, 0–1. */
  draw?: number | null;
  /** Extra letter spacing in em. */
  tracking?: number | null;
}

/** A loop keyframe: offsets in canvas units and degrees, scale and opacity as multipliers. */
export interface DesignLoopFrame {
  t: number;
  dx?: number | null;
  dy?: number | null;
  rotate?: number | null;
  scale?: number | null;
  opacity?: number | null;
  easing?: string | null;
}

/** A motion that repeats across the element's track, on top of its keyframes. */
export interface DesignLoop {
  frames: DesignLoopFrame[];
  repeat: number;
  alternate?: boolean;
  preset?: string | null;
  strength?: number;
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
  /** On a stage, a top-level element that scrolls up with the page. */
  scrolls?: boolean;
  /** The point it turns and scales about, as fractions of its box; null is the centre. */
  origin?: { x: number; y: number } | null;
  loop?: DesignLoop | null;
  clipShape?: 'inset' | 'circle' | null;
  backfaceHidden?: boolean;
  /** Tapping it scrolls the page to this position (canvas units). */
  tapScroll?: number | null;
  /** Editor-only: the sticker recipe and seed a group came from, for Shuffle. */
  recipe?: { id: string; seed: number } | null;

  text?: { runs: DesignRun[]; style: Typography; split?: { by: 'word' | 'letter'; stagger: number } | null } | null;
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
  rotateX?: number | null;
  rotateY?: number | null;
  skewX?: number | null;
  blur?: number | null;
  clip?: number[] | null;
  draw?: number | null;
  tracking?: number | null;
}

export interface MotionPreset {
  id: string;
  label: string;
  frames: PresetFrame[];
  /** basic | bounce | zoom | turn | reveal | text — how the picker files it. */
  group?: string;
  /** [x, y] pivot the preset needs (a swing hangs from the top). */
  origin?: [number, number] | null;
  clipShape?: 'inset' | 'circle' | null;
  /** shape | text when it only means something on one kind of element. */
  only?: 'shape' | 'text' | null;
  /** Splits the text into pieces that each play the frames in turn. */
  split?: { by: 'word' | 'letter'; stagger: number } | null;
}

export interface LoopPresetFrame { t: number; dx: number; dy: number; rotate: number; scale: number; opacity: number; easing?: string | null }

export interface LoopPreset {
  id: string;
  label: string;
  frames: LoopPresetFrame[];
  repeat: number;
  alternate: boolean;
  origin?: [number, number] | null;
  /** What it's good for, shown under the name. */
  use?: string | null;
}

export interface DesignCatalog {
  canvas: { width: number; referenceViewport: number };
  fontBaseUrl: string;
  fonts: CatalogFont[];
  variables: CatalogVariable[];
  enterPresets: MotionPreset[];
  exitPresets: MotionPreset[];
  loopPresets: LoopPreset[];
  easings: string[];
  fieldTypes: string[];
  linkPaths: string[];
  starters: { id: string; name: string; description: string }[];
  requiredThemeKeys: string[];
  limits: {
    softBytes: number; hardBytes: number; maxSvgBytes: number; maxImageBytes: number; maxElements: number;
    maxKeyframes: number; maxPageHeight: number; maxDepth: number;
    maxLoopRepeat?: number; maxBlur?: number; maxSkew?: number; maxSplitPieces?: number;
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

// ----- Art library (GET /api/designs/art/*) -----

export type ArtKind = 'vector' | 'animated' | 'picture';

export interface ArtSource {
  id: string;
  name: string;
  /** False when the server hasn't the account this library needs. */
  available: boolean;
  kinds: ArtKind[];
  note: string;
}

export interface ArtItem {
  source: string;
  id: string;
  title: string;
  thumb: string;
  /** What the file is: an svg or gif may move, an image doesn't. */
  kind: 'svg' | 'gif' | 'image';
  creator?: string | null;
  license: string;
  pageUrl?: string | null;
  width?: number | null;
  height?: number | null;
  tooLarge: boolean;
}

export interface ArtSearchResult {
  items: ArtItem[];
  page: number;
  hasMore: boolean;
  total?: number | null;
}

/** One keyframe of an imported layer: offsets in the art's own units, rotation and scale about its centre. */
export interface ArtFrame {
  t: number;
  dx: number;
  dy: number;
  rotate: number;
  scale: number;
  opacity: number;
}

/**
 * An illustration ready to place: layers back to front, each covering the whole `width`×`height`
 * box. Animated art comes with keyframes to play over a scroll track.
 */
export interface ArtImport {
  name: string;
  width: number;
  height: number;
  assets: DesignAssetUpload[];
  layers: { asset: string; name?: string | null; frames: ArtFrame[] }[];
  animated: boolean;
  seconds: number;
  loops: number;
  credit?: { source: string; creator?: string | null; license: string; pageUrl?: string | null } | null;
  bytes: number;
  /** A vector too detailed for an invitation, brought in as the library's own picture of it. */
  asPicture?: boolean;
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

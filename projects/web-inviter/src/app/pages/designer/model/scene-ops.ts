import type { UiTokenRun } from '@zouriel/ui/form';
import {
  CANVAS_WIDTH, REFERENCE_VIEWPORT,
  type DesignElement, type DesignKeyframe, type DesignRun, type DesignScene, type DesignTrack, type ElementType,
  type MotionPreset, type Typography,
} from './scene';

// ----- Ids ---------------------------------------------------------------------------------------

export function newId(prefix = 'e'): string {
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  return prefix + Array.from(rnd, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
}

// ----- Page metrics ------------------------------------------------------------------------------

export function pageHeight(scene: DesignScene): number {
  return scene.canvas.sections.reduce((sum, s) => sum + s.height, 0);
}

/** How far the reference phone scrolls: the page minus one screen. */
export function scrollRange(scene: DesignScene): number {
  return Math.max(0, pageHeight(scene) - REFERENCE_VIEWPORT);
}

/** Where each section starts on the page. */
export function sectionTops(scene: DesignScene): number[] {
  const tops: number[] = [];
  let y = 0;
  for (const s of scene.canvas.sections) {
    tops.push(y);
    y += s.height;
  }
  return tops;
}

/** Timeline markers: the scroll position at which each section reaches the top of the screen. */
export function sectionMarkers(scene: DesignScene): { at: number; label: string }[] {
  const range = scrollRange(scene);
  return sectionTops(scene)
    .map((top, i) => ({ at: Math.min(top, range), label: scene.canvas.sections[i].name }))
    .filter((m, i, all) => i === 0 || m.at > all[i - 1].at);
}

// ----- Tree --------------------------------------------------------------------------------------

export interface FlatElement {
  element: DesignElement;
  parentId: string | null;
  depth: number;
  index: number;
}

/** Every element, depth-first, in paint order (back to front). */
export function flatten(scene: DesignScene): FlatElement[] {
  const out: FlatElement[] = [];
  const walk = (list: DesignElement[], parentId: string | null, depth: number) =>
    list.forEach((element, index) => {
      out.push({ element, parentId, depth, index });
      if (element.children?.length) walk(element.children, element.id, depth + 1);
    });
  walk(scene.elements, null, 0);
  return out;
}

export function findElement(scene: DesignScene, id: string | null): DesignElement | null {
  if (!id) return null;
  return flatten(scene).find((f) => f.element.id === id)?.element ?? null;
}

export function parentOf(scene: DesignScene, id: string): DesignElement | null {
  const flat = flatten(scene).find((f) => f.element.id === id);
  return flat?.parentId ? findElement(scene, flat.parentId) : null;
}

/** Ancestors from the outermost group down to the direct parent. */
export function ancestors(scene: DesignScene, id: string): DesignElement[] {
  const chain: DesignElement[] = [];
  let parent = parentOf(scene, id);
  while (parent) {
    chain.unshift(parent);
    parent = parentOf(scene, parent.id);
  }
  return chain;
}

function mapList(list: DesignElement[], id: string, fn: (el: DesignElement) => DesignElement | null): DesignElement[] {
  let changed = false;
  const next: DesignElement[] = [];
  for (const el of list) {
    if (el.id === id) {
      changed = true;
      const replaced = fn(el);
      if (replaced) next.push(replaced);
      continue;
    }
    if (el.children?.length) {
      const children = mapList(el.children, id, fn);
      if (children !== el.children) {
        changed = true;
        next.push({ ...el, children });
        continue;
      }
    }
    next.push(el);
  }
  return changed ? next : list;
}

export function updateElement(scene: DesignScene, id: string, fn: (el: DesignElement) => DesignElement): DesignScene {
  const elements = mapList(scene.elements, id, fn);
  return elements === scene.elements ? scene : { ...scene, elements };
}

export function removeElement(scene: DesignScene, id: string): DesignScene {
  const elements = mapList(scene.elements, id, () => null);
  return elements === scene.elements ? scene : { ...scene, elements };
}

/** Inserts into `parentId`'s children (or the page), at `index` (default: in front of everything). */
export function insertElement(scene: DesignScene, el: DesignElement, parentId: string | null = null, index?: number): DesignScene {
  if (!parentId) {
    const list = [...scene.elements];
    list.splice(index ?? list.length, 0, el);
    return { ...scene, elements: list };
  }
  return updateElement(scene, parentId, (parent) => {
    const list = [...(parent.children ?? [])];
    list.splice(index ?? list.length, 0, el);
    return { ...parent, children: list };
  });
}

/** Moves an element within its own list. `toIndex` is the position in paint order (0 = back). */
export function reorderElement(scene: DesignScene, id: string, toIndex: number): DesignScene {
  const flat = flatten(scene).find((f) => f.element.id === id);
  if (!flat) return scene;
  const without = removeElement(scene, id);
  const siblings = flat.parentId ? findElement(without, flat.parentId)?.children ?? [] : without.elements;
  const clamped = Math.max(0, Math.min(siblings.length, toIndex));
  return insertElement(without, flat.element, flat.parentId, clamped);
}

/** A deep copy with fresh ids, offset a little so it's visibly a copy. */
export function cloneElement(el: DesignElement, offset = 16): DesignElement {
  const copy: DesignElement = structuredClone(el);
  const refresh = (e: DesignElement, top: boolean) => {
    e.id = newId();
    if (top) {
      e.x += offset;
      e.y += offset;
      e.keyframes = e.keyframes.map((k) => ({ ...k, x: k.x == null ? k.x : k.x + offset, y: k.y == null ? k.y : k.y + offset }));
      e.name = e.name ? `${e.name} copy` : e.name;
    }
    e.children?.forEach((c) => refresh(c, false));
  };
  refresh(copy, true);
  return copy;
}

/** Wraps sibling elements in a new group sized to their bounds; children become group-relative. */
export function groupElements(scene: DesignScene, ids: string[]): { scene: DesignScene; groupId: string | null } {
  const flat = flatten(scene).filter((f) => ids.includes(f.element.id));
  if (flat.length < 2) return { scene, groupId: null };
  const parentId = flat[0].parentId;
  if (flat.some((f) => f.parentId !== parentId)) return { scene, groupId: null };

  const minX = Math.min(...flat.map((f) => f.element.x));
  const minY = Math.min(...flat.map((f) => f.element.y));
  const maxX = Math.max(...flat.map((f) => f.element.x + f.element.w));
  const maxY = Math.max(...flat.map((f) => f.element.y + f.element.h));
  const index = Math.max(...flat.map((f) => f.index)) - flat.length + 1;

  const children = flat
    .sort((a, b) => a.index - b.index)
    .map((f) => shiftElement(f.element, -minX, -minY));
  let next = scene;
  for (const f of flat) next = removeElement(next, f.element.id);

  const group: DesignElement = {
    ...baseElement('group', minX, minY, maxX - minX, maxY - minY),
    name: 'Group',
    children,
  };
  next = insertElement(next, group, parentId, Math.max(0, index));
  return { scene: next, groupId: group.id };
}

/** Dissolves a group, putting its children back in page coordinates where it was. */
export function ungroupElement(scene: DesignScene, id: string): DesignScene {
  const flat = flatten(scene).find((f) => f.element.id === id);
  const group = flat?.element;
  if (!group || group.type !== 'group' || !flat) return scene;
  let next = removeElement(scene, id);
  const children = (group.children ?? []).map((c) => shiftElement(c, group.x, group.y));
  children.forEach((child, i) => (next = insertElement(next, child, flat.parentId, flat.index + i)));
  return next;
}

function shiftElement(el: DesignElement, dx: number, dy: number): DesignElement {
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
    keyframes: el.keyframes.map((k) => ({ ...k, x: k.x == null ? k.x : k.x + dx, y: k.y == null ? k.y : k.y + dy })),
  };
}

// ----- Motion ------------------------------------------------------------------------------------

export interface ElementState {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
}

export interface ResolvedFrame extends ElementState {
  t: number;
  easing: string | null;
}

export function trackOf(scene: DesignScene, el: DesignElement): DesignTrack {
  const range = Math.max(1, scrollRange(scene));
  if (!el.track) return { start: 0, end: range };
  const clamp = (v: number) => Math.min(range, Math.max(0, v));
  return { start: clamp(el.track.start), end: clamp(el.track.end) };
}

/** Same rules as the compiler: properties carry forward, first and last frames are held. */
export function resolveFrames(el: DesignElement): ResolvedFrame[] {
  const frames = [...el.keyframes].filter((k) => Number.isFinite(k.t)).sort((a, b) => a.t - b.t);
  const out: ResolvedFrame[] = [];
  let state: ElementState = { x: el.x, y: el.y, rotate: el.rotate, scale: el.scale, opacity: el.opacity };
  for (const k of frames) {
    state = {
      x: k.x ?? state.x,
      y: k.y ?? state.y,
      rotate: k.rotate ?? state.rotate,
      scale: k.scale ?? state.scale,
      opacity: Math.min(1, Math.max(0, k.opacity ?? state.opacity)),
    };
    const t = Math.min(1, Math.max(0, k.t));
    if (out.length && Math.abs(out[out.length - 1].t - t) < 1e-5) out.pop();
    out.push({ ...state, t, easing: k.easing ?? null });
  }
  if (!out.length) return out;
  if (out[0].t > 0) out.unshift({ ...out[0], t: 0, easing: null });
  if (out[out.length - 1].t < 1) out.push({ ...out[out.length - 1], t: 1, easing: null });
  return out;
}

/** Progress through the element's track at a scroll position, 0…1. */
export function progressAt(scene: DesignScene, el: DesignElement, scroll: number): number {
  const track = trackOf(scene, el);
  const span = track.end - track.start;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (scroll - track.start) / span));
}

/** The element's animated state at a scroll position — what the compiled CSS shows there. */
export function stateAt(scene: DesignScene, el: DesignElement, scroll: number): ElementState {
  const base: ElementState = { x: el.x, y: el.y, rotate: el.rotate, scale: el.scale, opacity: el.opacity };
  const frames = resolveFrames(el);
  if (!frames.length) return base;
  const t = progressAt(scene, el, scroll);
  let i = 0;
  while (i < frames.length - 2 && frames[i + 1].t <= t) i++;
  const a = frames[i];
  const b = frames[i + 1] ?? a;
  const span = b.t - a.t;
  const local = span <= 0 ? 1 : Math.min(1, Math.max(0, (t - a.t) / span));
  const eased = ease(a.easing, local);
  const lerp = (p: number, q: number) => p + (q - p) * eased;
  return { x: lerp(a.x, b.x), y: lerp(a.y, b.y), rotate: lerp(a.rotate, b.rotate), scale: lerp(a.scale, b.scale), opacity: lerp(a.opacity, b.opacity) };
}

/** How far a pinned element has been carried down the page at a scroll position. */
export function pinOffsetAt(scene: DesignScene, el: DesignElement, scroll: number): number {
  if (!el.pinned) return 0;
  const track = trackOf(scene, el);
  return Math.min(track.end - track.start, Math.max(0, scroll - track.start));
}

/** Where a group-nested element's coordinate space starts on the page at a scroll position. */
export function groupOffsetAt(scene: DesignScene, id: string, scroll: number): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const group of ancestors(scene, id)) {
    const s = stateAt(scene, group, scroll);
    x += s.x;
    y += s.y + pinOffsetAt(scene, group, scroll);
  }
  return { x, y };
}

export interface ScreenBox extends ElementState {
  w: number;
  h: number;
}

/**
 * Where an element is drawn on the page at a scroll position, in page units, composing its groups'
 * positions and pins. Group rotation and scale aren't composed into children — close enough to draw
 * selection handles, and the preview underneath is always the real thing.
 */
export function pageBoxAt(scene: DesignScene, id: string, scroll: number): ScreenBox | null {
  const el = findElement(scene, id);
  if (!el) return null;
  const offset = groupOffsetAt(scene, id, scroll);
  const s = stateAt(scene, el, scroll);
  return { ...s, x: s.x + offset.x, y: s.y + offset.y + pinOffsetAt(scene, el, scroll), w: el.w, h: el.h };
}

/** The keyframe within `tolerance` (in t) of `t`, if there is one. */
export function keyframeNear(el: DesignElement, t: number, tolerance: number): number {
  let best = -1;
  let dist = tolerance;
  el.keyframes.forEach((k, i) => {
    const d = Math.abs(k.t - t);
    if (d <= dist) { best = i; dist = d; }
  });
  return best;
}

export interface PlacementResult {
  element: DesignElement;
  /** A keyframe was created rather than edited. */
  created: boolean;
}

/**
 * Applies a move/rotate/scale made on the canvas at a scroll position. An element with no keyframes
 * just moves. An animated one: the keyframe under the playhead is edited, or a new one is made there —
 * "move it here at this frame".
 */
export function placeAt(
  scene: DesignScene, el: DesignElement, scroll: number, change: Partial<ElementState>,
): PlacementResult {
  if (!el.keyframes.length) return { element: { ...el, ...change }, created: false };

  const track = trackOf(scene, el);
  const span = Math.max(1, track.end - track.start);
  const t = progressAt(scene, el, scroll);
  const tolerance = Math.max(0.005, 4 / span);
  const index = keyframeNear(el, t, tolerance);
  const keyframes = [...el.keyframes];
  if (index >= 0) {
    keyframes[index] = { ...keyframes[index], ...change };
    return { element: { ...el, keyframes }, created: false };
  }
  // A new keyframe carries the full state at this moment, so nothing jumps.
  const now = stateAt(scene, el, scroll);
  keyframes.push({ t: round(t, 4), x: now.x, y: now.y, rotate: now.rotate, scale: now.scale, opacity: now.opacity, ...change });
  keyframes.sort((a, b) => a.t - b.t);
  return { element: { ...el, keyframes }, created: true };
}

/** Moves an element and every keyframe with it. */
export function moveWhole(el: DesignElement, dx: number, dy: number): DesignElement {
  return shiftElement(el, dx, dy);
}

/** Materialises a preset as keyframes, replacing the ones a previous preset in that slot made. */
export function applyPreset(el: DesignElement, preset: MotionPreset | null, slot: 'enter' | 'exit'): DesignElement {
  const kept = el.keyframes.filter((k) => k.preset !== slot);
  if (!preset) return { ...el, keyframes: kept, [slot]: null };
  const made: DesignKeyframe[] = preset.frames.map((f) => ({
    t: f.t,
    x: f.dx ? el.x + f.dx : null,
    y: f.dy ? el.y + f.dy : null,
    rotate: f.dRotate ? el.rotate + f.dRotate : null,
    scale: Math.abs(f.scale - 1) > 1e-4 ? el.scale * f.scale : null,
    opacity: Math.abs(f.opacity - 1) > 1e-4 ? el.opacity * f.opacity : null,
    easing: f.easing ?? null,
    preset: slot,
  }));
  // The preset's resting end states the resting values outright, so carry-forward can't keep an offset.
  const rest = slot === 'enter' ? made.reduce((a, b) => (b.t > a.t ? b : a)) : made.reduce((a, b) => (b.t < a.t ? b : a));
  rest.x ??= el.x; rest.y ??= el.y; rest.rotate ??= el.rotate; rest.scale ??= el.scale; rest.opacity ??= el.opacity;
  const keyframes = [...kept, ...made].sort((a, b) => a.t - b.t);
  return { ...el, keyframes, [slot]: preset.id, track: el.track ?? null };
}

// ----- Easing ------------------------------------------------------------------------------------

const KEYWORDS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

export function ease(easing: string | null | undefined, x: number): number {
  if (!easing || easing === 'linear') return x;
  let p = KEYWORDS[easing];
  if (!p) {
    const m = /^cubic-bezier\(([^)]+)\)$/.exec(easing);
    const nums = m?.[1].split(',').map(Number);
    if (!nums || nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return x;
    p = nums as [number, number, number, number];
  }
  return cubicBezier(p[0], p[1], p[2], p[3], x);
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slope = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x;
    const d = slope(t);
    if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  t = Math.min(1, Math.max(0, t));
  return sampleY(t);
}

// ----- Factories ---------------------------------------------------------------------------------

export function defaultTypography(size = 20, overrides: Partial<Typography> = {}): Typography {
  return {
    font: 'theme:body-font', size, weight: 400, italic: false, color: 'theme:text', align: 'center', valign: 'middle',
    lineHeight: 1.3, letterSpacing: 0, uppercase: false, ...overrides,
  };
}

function baseElement(type: ElementType, x: number, y: number, w: number, h: number): DesignElement {
  return { id: newId(), type, name: null, x, y, w, h, rotate: 0, scale: 1, opacity: 1, track: null, keyframes: [] };
}

/** Theme references the scene can actually resolve, falling back to a hex when the key is missing. */
function themeRef(scene: DesignScene, key: string, fallback: string): string {
  return scene.theme.some((t) => t.key === key) ? `theme:${key}` : fallback;
}

function fontRef(scene: DesignScene, key: string): string | null {
  return scene.theme.some((t) => t.key === key) ? `theme:${key}` : scene.fonts[0] ?? null;
}

/** A new element of a type, centred horizontally at a page y, using the scene's own theme. */
export function createElement(scene: DesignScene, type: ElementType, centerY: number, extra: Partial<DesignElement> = {}): DesignElement {
  const sizes: Record<ElementType, [number, number]> = {
    text: [300, 60], shape: [160, 160], svg: [160, 160], image: [240, 180], slot: [300, 220],
    rsvp: [220, 54], link: [220, 46], dress: [300, 110], group: [200, 200],
  };
  const [w, h] = sizes[type];
  const el = baseElement(type, Math.round((CANVAS_WIDTH - w) / 2), Math.round(centerY - h / 2), w, h);
  const text = themeRef(scene, 'text', '#222222');
  const accent = themeRef(scene, 'accent', '#b08d57');
  const bg = themeRef(scene, 'bg', '#ffffff');

  switch (type) {
    case 'text':
      el.name = 'Text';
      el.text = { runs: [{ text: 'Your text' }], style: { ...defaultTypography(22), font: fontRef(scene, 'body-font'), color: text } };
      break;
    case 'shape':
      el.name = 'Shape';
      el.shape = { kind: 'rect', sides: 6, fill: accent, stroke: null, strokeWidth: 0, radius: 0 };
      break;
    case 'slot':
      el.name = 'Photo';
      el.slot = { path: 'event.coverImage', label: 'Cover photo', fit: 'cover', radius: 12, multiple: false, min: null, max: null, columns: 2, gap: 8, aspect: 1 };
      break;
    case 'rsvp':
      el.name = 'RSVP button';
      el.button = { path: null, label: 'Reply now', fill: accent, stroke: null, strokeWidth: 0, radius: 999,
        style: { ...defaultTypography(17, { weight: 600 }), font: fontRef(scene, 'body-font'), color: bg } };
      break;
    case 'link':
      el.name = 'Link';
      el.button = { path: 'camera.link', label: 'Share your photos', fill: null, stroke: accent, strokeWidth: 1, radius: 999,
        style: { ...defaultTypography(15), font: fontRef(scene, 'body-font'), color: accent } };
      break;
    case 'dress':
      el.name = 'Dress colours';
      el.dress = { swatch: 40, shape: 'circle', gap: 10,
        style: { ...defaultTypography(14, { uppercase: true, letterSpacing: 0.12 }), font: fontRef(scene, 'body-font'), color: text } };
      break;
    case 'group':
      el.name = 'Group';
      el.children = [];
      break;
    case 'svg':
      el.name = 'Illustration';
      break;
    case 'image':
      el.name = 'Picture';
      break;
  }
  return { ...el, ...extra };
}

// ----- Colours & text ----------------------------------------------------------------------------

/** A colour reference as a CSS colour for the editor's own drawing (swatches, poster). */
export function resolveColor(scene: DesignScene, ref: string | null | undefined, fallback = 'transparent'): string {
  if (!ref) return fallback;
  if (ref.startsWith('theme:')) return scene.theme.find((t) => t.key === ref.slice(6))?.value ?? fallback;
  return ref;
}

export function isFontKey(key: string): boolean {
  return key.includes('font');
}

export function runsToTokens(runs: readonly DesignRun[]): UiTokenRun[] {
  return runs.map((r) => ({
    ...(r.var ? { token: r.var } : { text: r.text ?? '' }),
    ...(r.bold ? { bold: true } : {}),
    ...(r.italic ? { italic: true } : {}),
  }));
}

export function tokensToRuns(tokens: readonly UiTokenRun[]): DesignRun[] {
  return tokens.map((t) => ({
    ...(t.token !== undefined ? { var: t.token } : { text: t.text ?? '' }),
    ...(t.bold ? { bold: true } : {}),
    ...(t.italic ? { italic: true } : {}),
  }));
}

export function round(v: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** The element's display name. */
export function labelOf(el: DesignElement): string {
  if (el.name) return el.name;
  if (el.type === 'text') {
    const text = (el.text?.runs ?? []).map((r) => r.text ?? `{${r.var}}`).join('').trim();
    if (text) return text.length > 28 ? text.slice(0, 28) + '…' : text;
  }
  return el.type.charAt(0).toUpperCase() + el.type.slice(1);
}

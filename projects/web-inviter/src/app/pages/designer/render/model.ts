/**
 * A scene as the C# compiler sees it after `DesignScene.Parse`: every property the JSON leaves out takes
 * the model's default. The browser renderer compiles this, never the editor's looser objects, so a
 * missing field means the same thing in the preview as on the server.
 */
import { upgradeScene } from '../model/scene-ops';
import type { DesignScene } from '../model/scene';

export interface NTypography {
  font: string | null; size: number; weight: number; italic: boolean; color: string | null;
  align: string | null; valign: string | null; lineHeight: number; letterSpacing: number; uppercase: boolean;
  stroke: string | null; strokeWidth: number;
}
export interface NRun { text: string | null; var: string | null; bold: boolean; italic: boolean }
export interface NXY { x: number; y: number }
export interface NPoint { x: number; y: number; in: NXY | null; out: NXY | null }
export interface NContour { closed: boolean; points: NPoint[] }
export interface NPath { width: number; height: number; contours: NContour[] }
export interface NKeyframe {
  t: number; x: number | null; y: number | null; rotate: number | null; scale: number | null; opacity: number | null;
  lift: number | null; easing: string | null;
  rotateX: number | null; rotateY: number | null; skewX: number | null; skewY: number | null; blur: number | null;
  clip: number[] | null; draw: number | null; tracking: number | null;
}
export interface NLoopFrame { t: number; dx: number | null; dy: number | null; rotate: number | null; scale: number | null; opacity: number | null; easing: string | null }
export interface NPattern { kind: string | null; mode: string | null; size: number; strength: number; color: string | null }
export interface NBevel { style: string | null; size: number; strength: number }
export interface NGlow { color: string | null; size: number; strength: number; blend: string | null }
export interface NGradient { type: string | null; angle: number; stops: { color: string | null; at: number | null }[] }
export interface NShadow { color: string | null; x: number; y: number; blur: number; strength: number }
export interface NMask { kind: string | null; sides: number; amount: number | null }
export interface NAdjust { brightness: number; contrast: number; saturation: number; sepia: number; grain: number; duotone: { dark: string | null; light: string | null } | null }
export interface NLoop { frames: NLoopFrame[]; repeat: number; alternate: boolean }
export interface NElement {
  id: string; type: string; x: number; y: number; w: number; h: number; rotate: number; scale: number; opacity: number;
  track: { start: number; end: number } | null; keyframes: NKeyframe[]; pinned: boolean; block: string | null; roleScope: string | null;
  scrolls: boolean; pattern: NPattern | null; bevel: NBevel | null; innerGlow: NGlow | null; outerGlow: NGlow | null; blend: string | null; gradient: NGradient | null; shadow: NShadow | null; mask: NMask | null; light: { angle: number; color: string | null } | null; origin: NXY | null; loop: NLoop | null; clipShape: string | null; backfaceHidden: boolean; tapScroll: number | null;
  text: { runs: NRun[]; style: NTypography; split: { by: string; stagger: number } | null; curve: number; image: string | null } | null;
  shape: { kind: string | null; path: NPath | null; sides: number; amount: number | null; dash: string | null; fill: string | null; stroke: string | null; strokeWidth: number; radius: number } | null;
  svg: { asset: string; fills: Record<string, string>; tint: string | null; stretch: boolean } | null;
  image: { asset: string; fit: string | null; radius: number; tint: string | null; tintMode: string | null; adjust: NAdjust | null } | null;
  slot: {
    path: string | null; label: string | null; fit: string | null; radius: number; multiple: boolean; min: number | null; max: number | null;
    columns: number; gap: number; aspect: number; index: number | null; adjust: NAdjust | null;
  } | null;
  button: { path: string | null; label: string | null; fill: string | null; stroke: string | null; strokeWidth: number; radius: number; style: NTypography } | null;
  dress: { swatch: number; shape: string | null; gap: number; style: NTypography } | null;
  children: NElement[] | null;
}
export interface NField { path: string; label: string; type: string; options: string[] | null; roleScope: string | null; sample: string | null }
export interface NScene {
  stage: boolean;
  length: number | null;
  theme: { key: string; label: string; value: string }[];
  fonts: string[];
  roles: string[];
  fields: NField[];
  elements: NElement[];
  assets: Record<string, { kind: string; data: string; alpha?: boolean | null; mask?: string | null }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

/** A missing property takes the default; an explicit null on a reference stays null. */
const d = <T>(v: T | undefined, fallback: T): T => (v === undefined ? fallback : v);
/** Value types: C# can't hold null there, so null reads as the default too. */
const n = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);
const b = (v: unknown): boolean => v === true;
const s = (v: unknown, fallback: string | null): string | null => (v === undefined ? fallback : (v as string | null));
const nn = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export function typography(raw: Raw): NTypography {
  const t = raw ?? {};
  return {
    font: s(t.font, null), size: n(t.size, 18), weight: Math.trunc(n(t.weight, 400)), italic: b(t.italic), color: s(t.color, null),
    align: s(t.align, 'center'), valign: s(t.valign, 'middle'), lineHeight: n(t.lineHeight, 1.3), letterSpacing: n(t.letterSpacing, 0),
    uppercase: b(t.uppercase), stroke: s(t.stroke, null), strokeWidth: n(t.strokeWidth, 0),
  };
}

function xy(raw: Raw): NXY | null {
  return raw == null ? null : { x: n(raw.x, 0), y: n(raw.y, 0) };
}

function adjust(a: Raw): NAdjust | null {
  return a == null ? null : {
    brightness: n(a.brightness, 1), contrast: n(a.contrast, 1), saturation: n(a.saturation, 1), sepia: n(a.sepia, 0), grain: n(a.grain, 0),
    duotone: a.duotone == null ? null : { dark: s(a.duotone.dark, null), light: s(a.duotone.light, null) },
  };
}

function glow(g: Raw): NGlow | null {
  return g == null ? null : { color: s(g.color, null), size: n(g.size, 10), strength: n(g.strength, 0.75), blend: s(g.blend, null) };
}

function element(raw: Raw): NElement {
  const e = raw ?? {};
  return {
    id: e.id, type: e.type,
    x: n(e.x, 0), y: n(e.y, 0), w: n(e.w, 100), h: n(e.h, 40), rotate: n(e.rotate, 0), scale: n(e.scale, 1), opacity: n(e.opacity, 1),
    track: e.track == null ? null : { start: n(e.track.start, 0), end: n(e.track.end, 0) },
    keyframes: (e.keyframes ?? []).map((k: Raw) => ({
      t: n(k?.t, 0), x: nn(k?.x), y: nn(k?.y), rotate: nn(k?.rotate), scale: nn(k?.scale), opacity: nn(k?.opacity),
      lift: typeof k?.lift === 'number' ? Math.trunc(k.lift) : null, easing: s(k?.easing, null),
      rotateX: nn(k?.rotateX), rotateY: nn(k?.rotateY), skewX: nn(k?.skewX), skewY: nn(k?.skewY), blur: nn(k?.blur),
      clip: Array.isArray(k?.clip) ? k.clip.map((v: unknown) => n(v, 0)) : null, draw: nn(k?.draw), tracking: nn(k?.tracking),
    })),
    scrolls: b(e.scrolls),
    pattern: e.pattern == null ? null : { kind: s(e.pattern.kind, null), mode: s(e.pattern.mode, null), size: n(e.pattern.size, 1), strength: n(e.pattern.strength, 0.5), color: s(e.pattern.color, null) },
    bevel: e.bevel == null ? null : { style: s(e.bevel.style, null), size: n(e.bevel.size, 4), strength: n(e.bevel.strength, 0.7) },
    innerGlow: glow(e.innerGlow),
    outerGlow: glow(e.outerGlow),
    blend: s(e.blend, null),
    gradient: e.gradient == null ? null : {
      type: s(e.gradient.type, null), angle: n(e.gradient.angle, 180),
      stops: (e.gradient.stops ?? []).map((t: Raw) => ({ color: s(t?.color, null), at: nn(t?.at) })),
    },
    shadow: e.shadow == null ? null : { color: s(e.shadow.color, null), x: n(e.shadow.x, 0), y: n(e.shadow.y, 4), blur: n(e.shadow.blur, 8), strength: n(e.shadow.strength, 0.35) },
    light: e.light == null ? null : { angle: n(e.light.angle, 135), color: s(e.light.color, null) },
    mask: e.mask == null ? null : { kind: s(e.mask.kind, null), sides: Math.trunc(n(e.mask.sides, 6)), amount: nn(e.mask.amount) },
    origin: e.origin == null ? null : { x: n(e.origin.x, 0.5), y: n(e.origin.y, 0.5) },
    loop: e.loop == null ? null : {
      frames: (e.loop.frames ?? []).map((f: Raw) => ({
        t: n(f?.t, 0), dx: nn(f?.dx), dy: nn(f?.dy), rotate: nn(f?.rotate), scale: nn(f?.scale), opacity: nn(f?.opacity), easing: s(f?.easing, null),
      })),
      repeat: Math.trunc(n(e.loop.repeat, 1)), alternate: b(e.loop.alternate),
    },
    clipShape: s(e.clipShape, null), backfaceHidden: b(e.backfaceHidden), tapScroll: nn(e.tapScroll),
    pinned: b(e.pinned), block: s(e.block, null), roleScope: s(e.roleScope, null),
    text: e.text == null ? null : {
      runs: (e.text.runs ?? []).map((r: Raw) => ({ text: s(r?.text, null), var: s(r?.var, null), bold: b(r?.bold), italic: b(r?.italic) })),
      style: typography(e.text.style),
      split: e.text.split == null ? null : { by: s(e.text.split.by, 'word') as string, stagger: n(e.text.split.stagger, 0.4) },
      curve: n(e.text.curve, 0), image: s(e.text.image, null),
    },
    shape: e.shape == null ? null : {
      kind: s(e.shape.kind, 'rect'),
      path: e.shape.path == null ? null : {
        width: n(e.shape.path.width, 100), height: n(e.shape.path.height, 100),
        contours: (e.shape.path.contours ?? []).map((c: Raw) => ({
          closed: c?.closed === undefined ? true : b(c.closed),
          points: (c?.points ?? []).map((p: Raw) => ({ x: n(p?.x, 0), y: n(p?.y, 0), in: xy(p?.in), out: xy(p?.out) })),
        })),
      },
      sides: Math.trunc(n(e.shape.sides, 6)), amount: nn(e.shape.amount), dash: s(e.shape.dash, null), fill: s(e.shape.fill, null), stroke: s(e.shape.stroke, null),
      strokeWidth: n(e.shape.strokeWidth, 0), radius: n(e.shape.radius, 0),
    },
    svg: e.svg == null ? null : { asset: e.svg.asset, fills: e.svg.fills ?? {}, tint: s(e.svg.tint, null), stretch: e.svg.stretch === true },
    image: e.image == null ? null : { asset: e.image.asset, fit: s(e.image.fit, 'cover'), radius: n(e.image.radius, 0), tint: s(e.image.tint, null), tintMode: s(e.image.tintMode, null), adjust: adjust(e.image.adjust) },
    slot: e.slot == null ? null : {
      path: s(e.slot.path, 'event.coverImage'), label: s(e.slot.label, 'Photo'), fit: s(e.slot.fit, 'cover'), radius: n(e.slot.radius, 0),
      multiple: b(e.slot.multiple), min: typeof e.slot.min === 'number' ? Math.trunc(e.slot.min) : null,
      max: typeof e.slot.max === 'number' ? Math.trunc(e.slot.max) : null, columns: Math.trunc(n(e.slot.columns, 2)),
      gap: n(e.slot.gap, 8), aspect: n(e.slot.aspect, 1), index: typeof e.slot.index === 'number' ? Math.trunc(e.slot.index) : null,
      adjust: adjust(e.slot.adjust),
    },
    button: e.button == null ? null : {
      path: s(e.button.path, null), label: s(e.button.label, 'Open'), fill: s(e.button.fill, null), stroke: s(e.button.stroke, null),
      strokeWidth: n(e.button.strokeWidth, 0), radius: n(e.button.radius, 999), style: typography(e.button.style),
    },
    dress: e.dress == null ? null : {
      swatch: n(e.dress.swatch, 40), shape: s(e.dress.shape, 'circle'), gap: n(e.dress.gap, 10), style: typography(e.dress.style),
    },
    children: e.children == null ? null : e.children.map(element),
  };
}

export function normalizeScene(raw: Raw): NScene {
  // A design saved with screens is converted first, as `DesignScene.Parse` does on the server.
  const sc = raw?.schema === 2 ? upgradeScene(raw as DesignScene) : raw ?? {};
  return {
    stage: b(sc.stage),
    length: nn(sc.length),
    theme: d<Raw[]>(sc.theme, []).map((t: Raw) => ({ key: t.key, label: t.label, value: t.value })),
    fonts: d<string[]>(sc.fonts, []) ?? [],
    roles: d<string[]>(sc.roles, []) ?? [],
    fields: (d<Raw[]>(sc.fields, []) ?? []).map((f: Raw) => ({
      path: f.path, label: f.label, type: s(f.type, 'text') as string, options: f.options ?? null, roleScope: s(f.roleScope, null), sample: s(f.sample, null),
    })),
    elements: (d<Raw[]>(sc.elements, []) ?? []).map(element),
    assets: d<Record<string, Raw>>(sc.assets, {}) ?? {},
  };
}

/** Every element, depth-first, with its depth — `DesignScene.Walk()`. */
export function* walk(elements: NElement[], depth = 0): Generator<{ el: NElement; depth: number }> {
  for (const el of elements) {
    yield { el, depth };
    if (el.children) yield* walk(el.children, depth + 1);
  }
}

export const isFontKey = (key: string) => key.includes('font');

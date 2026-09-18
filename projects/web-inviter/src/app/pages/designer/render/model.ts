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
}
export interface NRun { text: string | null; var: string | null; bold: boolean; italic: boolean }
export interface NXY { x: number; y: number }
export interface NPoint { x: number; y: number; in: NXY | null; out: NXY | null }
export interface NContour { closed: boolean; points: NPoint[] }
export interface NPath { width: number; height: number; contours: NContour[] }
export interface NKeyframe {
  t: number; x: number | null; y: number | null; rotate: number | null; scale: number | null; opacity: number | null;
  lift: number | null; easing: string | null;
}
export interface NElement {
  id: string; type: string; x: number; y: number; w: number; h: number; rotate: number; scale: number; opacity: number;
  track: { start: number; end: number } | null; keyframes: NKeyframe[]; pinned: boolean; block: string | null; roleScope: string | null;
  text: { runs: NRun[]; style: NTypography } | null;
  shape: { kind: string | null; path: NPath | null; sides: number; fill: string | null; stroke: string | null; strokeWidth: number; radius: number } | null;
  svg: { asset: string; fills: Record<string, string> } | null;
  image: { asset: string; fit: string | null; radius: number } | null;
  slot: {
    path: string | null; label: string | null; fit: string | null; radius: number; multiple: boolean; min: number | null; max: number | null;
    columns: number; gap: number; aspect: number; index: number | null;
  } | null;
  button: { path: string | null; label: string | null; fill: string | null; stroke: string | null; strokeWidth: number; radius: number; style: NTypography } | null;
  dress: { swatch: number; shape: string | null; gap: number; style: NTypography } | null;
  children: NElement[] | null;
}
export interface NField { path: string; label: string; type: string; options: string[] | null; roleScope: string | null; sample: string | null }
export interface NScene {
  theme: { key: string; label: string; value: string }[];
  fonts: string[];
  roles: string[];
  fields: NField[];
  elements: NElement[];
  assets: Record<string, { kind: string; data: string }>;
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
    uppercase: b(t.uppercase),
  };
}

function xy(raw: Raw): NXY | null {
  return raw == null ? null : { x: n(raw.x, 0), y: n(raw.y, 0) };
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
    })),
    pinned: b(e.pinned), block: s(e.block, null), roleScope: s(e.roleScope, null),
    text: e.text == null ? null : {
      runs: (e.text.runs ?? []).map((r: Raw) => ({ text: s(r?.text, null), var: s(r?.var, null), bold: b(r?.bold), italic: b(r?.italic) })),
      style: typography(e.text.style),
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
      sides: Math.trunc(n(e.shape.sides, 6)), fill: s(e.shape.fill, null), stroke: s(e.shape.stroke, null),
      strokeWidth: n(e.shape.strokeWidth, 0), radius: n(e.shape.radius, 0),
    },
    svg: e.svg == null ? null : { asset: e.svg.asset, fills: e.svg.fills ?? {} },
    image: e.image == null ? null : { asset: e.image.asset, fit: s(e.image.fit, 'cover'), radius: n(e.image.radius, 0) },
    slot: e.slot == null ? null : {
      path: s(e.slot.path, 'event.coverImage'), label: s(e.slot.label, 'Photo'), fit: s(e.slot.fit, 'cover'), radius: n(e.slot.radius, 0),
      multiple: b(e.slot.multiple), min: typeof e.slot.min === 'number' ? Math.trunc(e.slot.min) : null,
      max: typeof e.slot.max === 'number' ? Math.trunc(e.slot.max) : null, columns: Math.trunc(n(e.slot.columns, 2)),
      gap: n(e.slot.gap, 8), aspect: n(e.slot.aspect, 1), index: typeof e.slot.index === 'number' ? Math.trunc(e.slot.index) : null,
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

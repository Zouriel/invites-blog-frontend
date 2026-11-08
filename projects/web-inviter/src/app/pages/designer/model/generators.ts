import { pathBounds, starContour, type UiPathContour, type UiPathPoint, type UiPathXY } from '@zouriel/ui/canvas';
import { REFERENCE_VIEWPORT, type DesignElement, type DesignPath, type DesignScene } from './scene';
import { newId, round } from './scene-ops';

/**
 * Generators: things made from a seed rather than drawn by hand — a scatter of dots, stars, hearts or
 * confetti; an organic blob; a curling vine with leaves. What they make is ordinary shapes (a group of
 * them, or one drawn shape), so afterwards each can be moved, recoloured, patterned or ungrouped.
 *
 * Everything comes from the seed through a small explicit random generator (mulberry32), so the same
 * seed and options always give the same result: on every device, after a reload, and in tests. The
 * element remembers its options and seed (`recipe` `gen:{…}`), so Shuffle and the panel can make it
 * again with a new seed or changed options.
 */

export type GeneratorKind = 'scatter' | 'blob' | 'vine';

export type ScatterShape = 'dots' | 'stars' | 'hearts' | 'confetti';
export type ScatterArea = 'screen' | 'top' | 'bottom' | 'edges';

export interface ScatterOptions { shape: ScatterShape; count: number; minSize: number; maxSize: number; area: ScatterArea; colors?: string[] | null }
export interface BlobOptions { points: number; wobble: number; size: number; color?: string | null }
export interface VineOptions { leaves: number; curl: number; length: number; direction: 'up' | 'down' | 'across'; leafSize: number; color?: string | null; leafColor?: string | null }

export type GeneratorOptions =
  | ({ kind: 'scatter' } & ScatterOptions)
  | ({ kind: 'blob' } & BlobOptions)
  | ({ kind: 'vine' } & VineOptions);

export const GEN_PREFIX = 'gen:';

export const DEFAULTS: { scatter: GeneratorOptions & { kind: 'scatter' }; blob: GeneratorOptions & { kind: 'blob' }; vine: GeneratorOptions & { kind: 'vine' } } = {
  scatter: { kind: 'scatter', shape: 'stars', count: 24, minSize: 8, maxSize: 20, area: 'screen' },
  blob: { kind: 'blob', points: 7, wobble: 0.3, size: 220 },
  vine: { kind: 'vine', leaves: 10, curl: 0.45, length: 420, direction: 'up', leafSize: 44 },
};

/** Named one-tap choices for the panel, and for the assistant's descriptions. */
export const SCATTER_COUNTS = { few: 10, some: 24, lots: 48 } as const;
export const SCATTER_SIZES = { small: [4, 10], medium: [8, 20], large: [16, 36] } as const;
export const BLOB_STYLES = { smooth: { points: 5, wobble: 0.18 }, wavy: { points: 7, wobble: 0.3 }, wild: { points: 10, wobble: 0.45 } } as const;
export const VINE_LEAVES = { few: 6, some: 10, lots: 16 } as const;
export const VINE_CURLS = { straight: 0.08, gentle: 0.45, curly: 0.9 } as const;
export const VINE_LENGTHS = { short: 260, medium: 420, long: 640 } as const;

/** A small, explicit random generator (mulberry32): the same seed gives the same numbers everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new seed for Shuffle and fresh inserts. */
export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
}

/** Options with every number inside what makes sense (they come from people, the assistant and old recipes). */
export function clampOptions(o: GeneratorOptions): GeneratorOptions {
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const int = (v: unknown, lo: number, hi: number, d: number) => Math.round(n(v, lo, hi, d));
  const colorList = (v: unknown) => (Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string').slice(0, 8) : null);
  const colorOf = (v: unknown) => (typeof v === 'string' ? v : null);
  switch (o.kind) {
    case 'scatter': {
      const d = DEFAULTS.scatter;
      const minSize = n(o.minSize, 2, 120, d.minSize);
      const maxSize = n(o.maxSize, minSize, 160, Math.max(minSize, d.maxSize));
      const shape = (['dots', 'stars', 'hearts', 'confetti'] as const).includes(o.shape) ? o.shape : d.shape;
      const area = (['screen', 'top', 'bottom', 'edges'] as const).includes(o.area) ? o.area : d.area;
      const colors = colorList(o.colors);
      return { kind: 'scatter', shape, count: int(o.count, 1, 120, d.count), minSize, maxSize, area, ...(colors?.length ? { colors } : {}) };
    }
    case 'blob': {
      const d = DEFAULTS.blob;
      const color = colorOf(o.color);
      return { kind: 'blob', points: int(o.points, 4, 14, d.points), wobble: n(o.wobble, 0, 0.6, d.wobble), size: n(o.size, 20, 800, d.size), ...(color ? { color } : {}) };
    }
    case 'vine': {
      const d = DEFAULTS.vine;
      const color = colorOf(o.color);
      const leafColor = colorOf(o.leafColor);
      const direction = (['up', 'down', 'across'] as const).includes(o.direction) ? o.direction : d.direction;
      return {
        kind: 'vine', leaves: int(o.leaves, 0, 40, d.leaves), curl: n(o.curl, 0, 1, d.curl), length: n(o.length, 80, 1600, d.length), direction,
        leafSize: n(o.leafSize, 8, 120, d.leafSize), ...(color ? { color } : {}), ...(leafColor ? { leafColor } : {}),
      };
    }
  }
}

/** The recipe id that remembers a generator's options. */
export function recipeId(options: GeneratorOptions): string {
  return GEN_PREFIX + JSON.stringify(options);
}

/** A generated element's options and seed, read back from its recipe; null for anything else. */
export function generatedOf(el: DesignElement | null | undefined): { options: GeneratorOptions; seed: number } | null {
  const id = el?.recipe?.id;
  if (!id?.startsWith(GEN_PREFIX)) return null;
  try {
    const raw = JSON.parse(id.slice(GEN_PREFIX.length)) as GeneratorOptions;
    if (!raw || !['scatter', 'blob', 'vine'].includes(raw.kind)) return null;
    return { options: clampOptions(raw), seed: el!.recipe!.seed };
  } catch {
    return null;
  }
}

// ----- Colours -----------------------------------------------------------------------------------

/** The theme's colours to draw with, best first (never the page or text colour unless that's all there is). */
export function themeColors(scene: DesignScene): string[] {
  const theme = scene.theme.filter((t) => !t.key.includes('font') && /^#/.test(t.value));
  const keys = theme.map((t) => t.key).filter((k) => k !== 'bg' && k !== 'text');
  const ordered = ['accent', ...keys].filter((k, i, a) => a.indexOf(k) === i && theme.some((t) => t.key === k));
  const refs = ordered.map((k) => `theme:${k}`);
  if (refs.length) return refs;
  return theme.some((t) => t.key === 'text') ? ['theme:text'] : ['#b08d57'];
}

// ----- Outlines ----------------------------------------------------------------------------------

const P = (x: number, y: number, inn?: [number, number], out?: [number, number]) => ({
  x, y, ...(inn ? { in: { x: inn[0], y: inn[1] } } : {}), ...(out ? { out: { x: out[0], y: out[1] } } : {}),
});

const HEART: DesignPath = {
  width: 100, height: 92,
  contours: [{ closed: true, points: [
    P(50, 92, [12, 62], [88, 62]), P(100, 28, [100, 58], [100, 10]), P(73, 0, [92, 0], [60, 0]),
    P(50, 18, [52, 6], [48, 6]), P(27, 0, [40, 0], [8, 0]), P(0, 28, [0, 10], [0, 58]),
  ] }],
};

/** A leaf pointing up: its tip at the top, its stalk end at the bottom middle. */
export const LEAF: DesignPath = {
  width: 50, height: 100,
  contours: [{ closed: true, points: [P(25, 0, [2, 34], [48, 34]), P(25, 100, [50, 64], [0, 64])] }],
};

function star(): DesignPath {
  const c = starContour(0, 0, 100, 100, 5, 0.46);
  return { width: 100, height: 100, contours: [{ closed: true, points: c.points.map((p) => ({ x: round(p.x, 2), y: round(p.y, 2) })) }] };
}

/** A confetti shard: a skewed four-sided sliver. */
function shard(rnd: () => number): DesignPath {
  const j = () => round(rnd() * 22, 1);
  return { width: 100, height: 60, contours: [{ closed: true, points: [P(j(), j()), P(100 - j(), j()), P(100 - j(), 60 - j()), P(j(), 60 - j())] }] };
}

// ----- Builders ----------------------------------------------------------------------------------

function base(type: DesignElement['type'], x: number, y: number, w: number, h: number, name: string): DesignElement {
  return { id: newId(), type, name, x: round(x, 1), y: round(y, 1), w: round(w, 1), h: round(h, 1), rotate: 0, scale: 1, opacity: 1, track: null, keyframes: [] };
}

function pathShape(x: number, y: number, w: number, h: number, outline: DesignPath, fill: string | null, name: string, stroke: string | null = null, strokeWidth = 0): DesignElement {
  const el = base('shape', x, y, w, h, name);
  el.shape = { kind: 'path', sides: 6, fill, stroke, strokeWidth, radius: 0, path: structuredClone(outline) };
  return el;
}

/** A group around its children, with the children moved to be relative to it. */
function wrap(children: DesignElement[], name: string): DesignElement {
  const minX = Math.min(...children.map((c) => c.x));
  const minY = Math.min(...children.map((c) => c.y));
  const maxX = Math.max(...children.map((c) => c.x + c.w));
  const maxY = Math.max(...children.map((c) => c.y + c.h));
  const group = base('group', minX, minY, maxX - minX, maxY - minY, name);
  group.children = children.map((c) => ({ ...c, x: round(c.x - minX, 1), y: round(c.y - minY, 1) }));
  return group;
}

const between = (rnd: () => number, a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(rnd: () => number, list: readonly T[]) => list[Math.floor(rnd() * list.length) % list.length];

/** The part of the 390 × 844 screen a scatter fills, and the part it keeps clear. */
function areaOf(area: ScatterArea): { x0: number; y0: number; x1: number; y1: number; clear?: { x0: number; y0: number; x1: number; y1: number } } {
  const H = REFERENCE_VIEWPORT;
  switch (area) {
    case 'top': return { x0: 12, y0: 12, x1: 378, y1: 280 };
    case 'bottom': return { x0: 12, y0: H - 280, x1: 378, y1: H - 12 };
    case 'edges': return { x0: 8, y0: 8, x1: 382, y1: H - 8, clear: { x0: 70, y0: 150, x1: 320, y1: H - 150 } };
    default: return { x0: 12, y0: 12, x1: 378, y1: H - 12 };
  }
}

/**
 * Scatter: pieces spread evenly but irregularly over an area (Mitchell's best candidate: each piece goes
 * to whichever of a few random spots is farthest from the pieces already there), in theme colours.
 */
function scatter(o: ScatterOptions, rnd: () => number, colors: string[]): DesignElement {
  const a = areaOf(o.area);
  const placed: { x: number; y: number }[] = [];
  const children: DesignElement[] = [];
  const starPath = star();
  const names: Record<ScatterShape, string> = { dots: 'Dot', stars: 'Star', hearts: 'Heart', confetti: 'Confetti' };
  for (let i = 0; i < o.count; i++) {
    let best: { x: number; y: number } | null = null;
    let bestDist = -1;
    for (let k = 0; k < 10; k++) {
      const x = between(rnd, a.x0, a.x1);
      const y = between(rnd, a.y0, a.y1);
      if (a.clear && x > a.clear.x0 && x < a.clear.x1 && y > a.clear.y0 && y < a.clear.y1) continue;
      const d = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), Infinity);
      if (d > bestDist) { best = { x, y }; bestDist = d; }
    }
    // An edges area can reject every candidate: fall back to the top or bottom band.
    if (!best) best = { x: between(rnd, a.x0, a.x1), y: rnd() < 0.5 ? between(rnd, a.y0, a.y0 + 120) : between(rnd, a.y1 - 120, a.y1) };
    placed.push(best);
    const size = between(rnd, o.minSize, o.maxSize);
    const fill = pick(rnd, colors);
    const name = `${names[o.shape]} ${i + 1}`;
    let el: DesignElement;
    switch (o.shape) {
      case 'dots':
        el = base('shape', best.x - size / 2, best.y - size / 2, size, size, name);
        el.shape = { kind: 'ellipse', sides: 6, fill, stroke: null, strokeWidth: 0, radius: 0 };
        break;
      case 'stars':
        el = pathShape(best.x - size / 2, best.y - size / 2, size, size, starPath, fill, name);
        el.rotate = round(between(rnd, -18, 18), 1);
        break;
      case 'hearts':
        el = pathShape(best.x - size / 2, best.y - (size * 0.92) / 2, size, size * 0.92, HEART, fill, name);
        el.rotate = round(between(rnd, -25, 25), 1);
        break;
      default: {
        const w = size;
        const h = size * between(rnd, 0.35, 0.6);
        const kind = rnd();
        if (kind < 0.4) {
          el = base('shape', best.x - w / 2, best.y - h / 2, w, h, name);
          el.shape = { kind: 'rect', sides: 6, fill, stroke: null, strokeWidth: 0, radius: round(h * 0.2, 1) };
        } else if (kind < 0.65) {
          el = base('shape', best.x - h / 2, best.y - h / 2, h * 1.2, h * 1.2, name);
          el.shape = { kind: 'polygon', sides: 3, fill, stroke: null, strokeWidth: 0, radius: 0 };
        } else el = pathShape(best.x - w / 2, best.y - h / 2, w, h, shard(rnd), fill, name);
        el.rotate = round(between(rnd, -180, 180), 1);
      }
    }
    children.push(el);
  }
  return wrap(children, o.shape === 'confetti' ? 'Confetti' : `Scattered ${o.shape}`);
}

/** Catmull-Rom handles through a closed loop of points: a smooth curve with no corners. */
function smoothLoop(pts: UiPathXY[]): UiPathPoint[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const tx = (next.x - prev.x) / 6;
    const ty = (next.y - prev.y) / 6;
    return { x: p.x, y: p.y, in: { x: p.x - tx, y: p.y - ty }, out: { x: p.x + tx, y: p.y + ty } };
  });
}

/** Catmull-Rom handles through an open run of points (the ends pull towards their neighbour). */
function smoothRun(pts: UiPathXY[]): UiPathPoint[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const k = i === 0 || i === n - 1 ? 3 : 6;
    const tx = (next.x - prev.x) / k;
    const ty = (next.y - prev.y) / k;
    return { x: p.x, y: p.y, in: i === 0 ? null : { x: p.x - tx, y: p.y - ty }, out: i === n - 1 ? null : { x: p.x + tx, y: p.y + ty } };
  });
}

/** A DesignPath of contours, moved into a box that starts at 0, 0. Returns where that box was. */
function toPath(contours: UiPathContour[], pad = 0): { path: DesignPath; box: { x: number; y: number; w: number; h: number } } {
  const b = pathBounds(contours)!;
  const x0 = b.x - pad;
  const y0 = b.y - pad;
  const w = Math.max(1, b.w + pad * 2);
  const h = Math.max(1, b.h + pad * 2);
  const r2 = (v: number) => round(v, 2);
  const mv = (q: UiPathXY | null | undefined) => (q ? { x: r2(q.x - x0), y: r2(q.y - y0) } : null);
  return {
    path: {
      width: r2(w), height: r2(h),
      contours: contours.map((c) => ({ closed: c.closed, points: c.points.map((p) => ({ x: r2(p.x - x0), y: r2(p.y - y0), in: mv(p.in), out: mv(p.out) })) })),
    },
    box: { x: x0, y: y0, w, h },
  };
}

/**
 * The outline of a blob: points round a circle at radii nudged by the seed (each nudge softened by its
 * neighbours so nothing spikes), joined by a smooth curve.
 */
export function blobPath(points: number, wobble: number, rnd: () => number): DesignPath {
  const raw = Array.from({ length: points }, () => rnd() * 2 - 1);
  const soft = raw.map((v, i) => (v * 2 + raw[(i + 1) % points] + raw[(i - 1 + points) % points]) / 4);
  const pts = soft.map((v, i) => {
    const a = ((i + (rnd() - 0.5) * 0.35) / points) * Math.PI * 2;
    const r = 50 * (1 + v * wobble * 1.6);
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  });
  return toPath([{ closed: true, points: smoothLoop(pts) }]).path;
}

function blob(o: BlobOptions, rnd: () => number, colors: string[]): DesignElement {
  const path = blobPath(o.points, o.wobble, rnd);
  // Its box keeps the outline's own proportions, `size` across its longer side.
  const k = o.size / Math.max(path.width, path.height);
  return pathShape(0, 0, path.width * k, path.height * k, path, o.color ?? colors[0], 'Blob');
}

/**
 * A vine: a stem walked forward a step at a time, its heading swaying with the curl and tightening into
 * a curl at the tip; leaves on alternate sides, biggest at the base, each turned off the stem.
 */
function vine(o: VineOptions, rnd: () => number, colors: string[]): DesignElement {
  const steps = 48;
  const step = o.length / steps;
  const phase = rnd() * Math.PI * 2;
  const sway = 0.5 + rnd();
  const side0 = rnd() < 0.5 ? 1 : -1;
  // Heading in radians, 0 straight up, clockwise positive.
  const heading = (s: number) => o.curl * (Math.sin(phase + s * Math.PI * 2 * sway) * 0.7 + side0 * Math.pow(s, 4) * 5);
  const pts: UiPathXY[] = [{ x: 0, y: 0 }];
  const headings: number[] = [heading(0)];
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    const h = heading(s);
    const p = pts[i - 1];
    pts.push({ x: p.x + Math.sin(h) * step, y: p.y - Math.cos(h) * step });
    headings.push(h);
  }
  // Turn the whole vine to grow the way asked (it was built growing up).
  const turn = o.direction === 'down' ? Math.PI : o.direction === 'across' ? Math.PI / 2 : 0;
  const rot = (p: UiPathXY): UiPathXY => ({ x: p.x * Math.cos(turn) - p.y * Math.sin(turn), y: p.x * Math.sin(turn) + p.y * Math.cos(turn) });

  const stemColor = o.color ?? colors[0];
  const leafColor = o.leafColor ?? colors[1] ?? stemColor;
  const strokeWidth = round(Math.max(1.5, o.length / 140), 1);
  const anchors = pts.filter((_, i) => i % 4 === 0 || i === steps).map(rot);
  const stemOutline = toPath([{ closed: false, points: smoothRun(anchors) }], strokeWidth / 2);
  const stem = pathShape(stemOutline.box.x, stemOutline.box.y, stemOutline.box.w, stemOutline.box.h, stemOutline.path, null, 'Stem', stemColor, strokeWidth);

  const leaves: DesignElement[] = [];
  for (let k = 0; k < o.leaves; k++) {
    const s = o.leaves === 1 ? 0.5 : 0.1 + (k / (o.leaves - 1)) * 0.82;
    const i = Math.min(steps, Math.round(s * steps));
    const side = (k % 2 === 0 ? 1 : -1) * side0;
    const angle = headings[i] + turn + side * between(rnd, 0.7, 1.05);
    const size = o.leafSize * (1 - 0.45 * s) * between(rnd, 0.85, 1.12);
    const w = size * 0.55;
    const h = size;
    const at = rot(pts[i]);
    // The leaf's stalk end sits on the stem; its tip points out along `angle`.
    const cx = at.x + Math.sin(angle) * h * 0.47;
    const cy = at.y - Math.cos(angle) * h * 0.47;
    const leaf = pathShape(cx - w / 2, cy - h / 2, w, h, LEAF, leafColor, `Leaf ${k + 1}`);
    leaf.rotate = round(((angle * 180) / Math.PI + 540) % 360 - 180, 1);
    leaves.push(leaf);
  }
  return wrap([stem, ...leaves], 'Vine');
}

/**
 * Makes a generator's element, its top left in screen units (0, 0 is the top left of a 390 × 844 screen):
 * a scatter lands where its area is; a blob or a vine in the middle of the screen.
 */
export function generate(scene: DesignScene, raw: GeneratorOptions, seed: number): DesignElement {
  const options = clampOptions(raw);
  const rnd = mulberry32(seed);
  const colors = themeColors(scene);
  let el: DesignElement;
  switch (options.kind) {
    case 'scatter': el = scatter(options, rnd, options.colors?.length ? options.colors : colors); break;
    case 'blob': el = blob(options, rnd, colors); break;
    case 'vine': el = vine(options, rnd, colors); break;
  }
  if (options.kind !== 'scatter') el = { ...el, x: round((390 - el.w) / 2, 1), y: round((REFERENCE_VIEWPORT - el.h) / 2, 1) };
  return { ...el, recipe: { id: recipeId(options), seed } };
}

/**
 * The same generator again (another seed or other options) for an element already on the page: it stays
 * where it was put, and keeps everything set on it since (name, motion, pattern, effects; a blob its size
 * and colour too). Returns null when the element wasn't generated.
 */
export function regenerate(scene: DesignScene, el: DesignElement, change: { seed?: number; options?: GeneratorOptions }): DesignElement | null {
  const was = generatedOf(el);
  if (!was) return null;
  const options = clampOptions(change.options ?? was.options);
  // A blob is one shape and the others are groups: one can't become the other in place.
  if (options.kind !== was.options.kind && (options.kind === 'blob' || was.options.kind === 'blob')) return null;
  const seed = change.seed ?? was.seed;
  const fresh = generate(scene, options, seed);
  if (options.kind === 'blob' && was.options.kind === 'blob' && el.shape) {
    // A blob keeps its box, colour and anything else set on it; only the outline changes. A new size resizes it about its centre.
    const sized = options.size !== was.options.size;
    const w = sized ? fresh.w : el.w;
    const h = sized ? fresh.h : el.h;
    return {
      ...el, x: round(el.x + (el.w - w) / 2, 1), y: round(el.y + (el.h - h) / 2, 1), w, h,
      shape: { ...el.shape, kind: 'path', path: fresh.shape!.path, ...(options.color ? { fill: options.color } : {}) },
      recipe: fresh.recipe,
    };
  }
  // Where the old one's frame was: what it was made at, moved as the element has been moved since.
  const old = generate(scene, was.options, was.seed);
  const ox = el.x - old.x;
  const oy = el.y - old.y;
  return { ...el, x: round(fresh.x + ox, 1), y: round(fresh.y + oy, 1), w: fresh.w, h: fresh.h, children: fresh.children, shape: fresh.shape ?? el.shape, recipe: fresh.recipe };
}

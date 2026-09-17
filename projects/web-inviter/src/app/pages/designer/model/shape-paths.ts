import polygonClipping, { type MultiPolygon, type Ring } from 'polygon-clipping';
import {
  type UiPathContour, type UiPathItem, type UiPathPoint, type UiPathXY, ellipseContour, flattenContour, pathBounds, polygonContour,
  rectContour, scaleContours, translateContours,
} from '@zouriel/ui/canvas';
import type { DesignElement, DesignPath } from './scene';

/**
 * Drawn shapes: turning a shape element into outlines the shape editor can work on, combining pieces,
 * and turning the result back into one shape. Coordinates are the element's own units (its w × h box),
 * so what's drawn lands exactly where the shape was.
 */

/** The element's current shape as editable outlines in its w × h box. */
export function shapeToContours(el: DesignElement): UiPathContour[] {
  const shape = el.shape;
  const w = Math.max(1, el.w);
  const h = Math.max(1, el.h);
  if (!shape) return [rectContour(0, 0, w, h)];
  switch (shape.kind) {
    case 'path': {
      const path = shape.path;
      if (!path?.contours.length) return [rectContour(0, 0, w, h)];
      return scaleContours(path.contours, 0, 0, w / Math.max(1, path.width), h / Math.max(1, path.height));
    }
    case 'ellipse':
      return [ellipseContour(w / 2, h / 2, w / 2, h / 2)];
    case 'polygon':
      return [polygonContour(0, 0, w, h, shape.sides)];
    case 'line':
      return [{ closed: false, points: [{ x: 0, y: h / 2 }, { x: w, y: h / 2 }] }];
    default:
      return [rectContour(0, 0, w, h, shape.radius)];
  }
}

function ring(contour: UiPathContour): Ring | null {
  const pts = flattenContour(contour, 20);
  if (pts.length < 3) return null;
  const r: Ring = pts.map((p) => [p.x, p.y]);
  r.push([pts[0].x, pts[0].y]);
  return r;
}

/** One item's closed outlines as a filled area (overlapping outlines add up, as they fill). */
function areaOf(item: UiPathItem): MultiPolygon | null {
  const polys: MultiPolygon = [];
  for (const c of item.contours) {
    if (!c.closed) continue;
    const r = ring(c);
    if (r) polys.push([r]);
  }
  if (!polys.length) return null;
  return polys.length === 1 ? polys : polygonClipping.union(polys[0], ...polys.slice(1));
}

/** Removes points that sit on a nearly straight line between their neighbours (Ramer–Douglas–Peucker). */
function simplify(points: UiPathXY[], tolerance: number): UiPathXY[] {
  if (points.length < 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let dist = tolerance;
    const pa = points[a];
    const pb = points[b];
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i];
      const d = Math.abs((pb.x - pa.x) * (pa.y - p.y) - (pa.x - p.x) * (pb.y - pa.y)) / len;
      if (d > dist) { dist = d; far = i; }
    }
    if (far >= 0) {
      keep[far] = true;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Simplifies a closed loop. A loop's start and end are the same point, so it is split at the point
 * farthest from its start and each half simplified as an open run.
 */
export function simplifyRing(points: UiPathXY[], tolerance: number): UiPathXY[] {
  if (points.length < 4) return points;
  let far = 1;
  let best = -1;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - points[0].x, p.y - points[0].y);
    if (d > best) { best = d; far = i; }
  });
  const first = simplify(points.slice(0, far + 1), tolerance);
  const second = simplify([...points.slice(far), points[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
}

/**
 * Merges the pieces into one outline, top to bottom as listed: each piece adds its area, or cuts it out
 * of everything before it when marked `cut`. Curves come back as fine straight segments. Open lines
 * aren't areas, so they are kept as they are.
 */
export function mergeItems(items: readonly UiPathItem[]): UiPathContour[] {
  let area: MultiPolygon | null = null;
  const lines: UiPathContour[] = [];
  for (const item of items) {
    lines.push(...item.contours.filter((c) => !c.closed));
    const piece = areaOf(item);
    if (!piece) continue;
    if (item.cut) {
      if (area) area = polygonClipping.difference(area, piece);
    } else {
      area = area ? polygonClipping.union(area, piece) : piece;
    }
  }
  const contours: UiPathContour[] = [];
  for (const polygon of area ?? []) {
    for (const r of polygon) {
      const pts = r.slice(0, -1).map(([x, y]) => ({ x, y }));
      const fitted = fitRing(simplifyRing(pts, 0.05));
      if (fitted.length >= 2) contours.push({ closed: true, points: fitted });
    }
  }
  return [...contours, ...lines];
}

/**
 * The editor's pieces as one drawn shape. Pieces that only add are kept as separate outlines (curves
 * intact — filled together they read as one shape); if anything is cut out, the pieces are merged.
 * Returns the outline in its own box and where that box sits in the element's units.
 */
export function itemsToPath(items: readonly UiPathItem[]): { path: DesignPath; box: { x: number; y: number; w: number; h: number } } | null {
  const contours = items.some((i) => i.cut) ? mergeItems(items) : items.flatMap((i) => i.contours);
  const usable = contours.filter((c) => c.points.length >= 2);
  const b = pathBounds(usable);
  if (!b) return null;
  const w = Math.max(1, b.w);
  const h = Math.max(1, b.h);
  const moved = translateContours(usable, -b.x, -b.y).map((c) => ({
    closed: c.closed,
    points: c.points.map((p) => ({
      x: r2(p.x), y: r2(p.y),
      ...(p.in ? { in: { x: r2(p.in.x), y: r2(p.in.y) } } : {}),
      ...(p.out ? { out: { x: r2(p.out.x), y: r2(p.out.y) } } : {}),
    })),
  }));
  return { path: { width: r2(w), height: r2(h), contours: moved }, box: { x: b.x, y: b.y, w, h } };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The SVG `d` of a drawn shape's closed outlines, scaled to a box — for canvases that paint it (the poster). */
export function pathFill(path: DesignPath, w: number, h: number): { closed: UiPathContour[]; open: UiPathContour[] } {
  const scaled = scaleContours(path.contours, 0, 0, w / Math.max(1, path.width), h / Math.max(1, path.height));
  return { closed: scaled.filter((c) => c.closed), open: scaled.filter((c) => !c.closed) };
}

// ----- Curve fitting ---------------------------------------------------------------------------------
//
// A merge comes back from the polygon library as short straight segments. Handing those to someone on a
// phone means a curve made of thirty points that can't be edited one at a time. So the loop is split at
// its corners and each run between corners is fitted with as few cubic curves as stay within a
// fraction of a unit (Schneider, "An Algorithm for Automatically Fitting Digitized Curves", 1990).

const FIT_ERROR = 0.6;
const CORNER_DEGREES = 38;

type V = UiPathXY;
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k });
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y;
const norm = (a: V): V => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);

/** Fits a closed loop of points with curves, keeping sharp turns as corners. */
export function fitRing(points: V[]): UiPathPoint[] {
  const n = points.length;
  if (n < 3) return points.map((p) => ({ x: r2(p.x), y: r2(p.y) }));
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n];
    const b = points[i];
    const c = points[(i + 1) % n];
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(b, a)), norm(sub(c, b)))))) * 180 / Math.PI;
    if (turn > CORNER_DEGREES) corners.push(i);
  }
  // A loop with no corners (a circle) still needs somewhere to start and a second anchor.
  if (corners.length === 0) corners.push(0, Math.floor(n / 2));
  else if (corners.length === 1) corners.push((corners[0] + Math.floor(n / 2)) % n);

  const anchors: UiPathPoint[] = [];
  for (let k = 0; k < corners.length; k++) {
    const from = corners[k];
    const to = corners[(k + 1) % corners.length];
    const run: V[] = [];
    for (let i = from; ; i = (i + 1) % n) {
      run.push(points[i]);
      if (i === to && run.length > 1) break;
    }
    for (const [p0, c1, c2, p3] of fitCubic(run, FIT_ERROR)) {
      const straight = isStraight(p0, c1, c2, p3);
      // Runs chain corner to corner, so each curve starts where the last anchor is.
      if (!anchors.length) anchors.push({ x: p0.x, y: p0.y, in: null, out: null });
      anchors[anchors.length - 1].out = straight ? null : c1;
      anchors.push({ x: p3.x, y: p3.y, in: straight ? null : c2, out: null });
    }
  }
  // The loop's last anchor is its first point again: fold its incoming handle into the first.
  if (anchors.length > 1 && dist(anchors[0], anchors.at(-1)!) < 1e-6) {
    const last = anchors.pop()!;
    anchors[0].in = last.in ?? null;
  }
  return anchors.map((p) => ({
    x: r2(p.x), y: r2(p.y),
    in: p.in ? { x: r2(p.in.x), y: r2(p.in.y) } : null,
    out: p.out ? { x: r2(p.out.x), y: r2(p.out.y) } : null,
  }));
}

/** A curve whose handles lie on its chord is a straight line; drawing it as one keeps the point a corner. */
function isStraight(p0: V, c1: V, c2: V, p3: V): boolean {
  const len = dist(p0, p3);
  if (len < 1e-6) return true;
  const off = (q: V) => Math.abs((p3.x - p0.x) * (p0.y - q.y) - (p0.x - q.x) * (p3.y - p0.y)) / len;
  return off(c1) < 0.15 && off(c2) < 0.15;
}

type Cubic = [V, V, V, V];

function fitCubic(points: V[], error: number): Cubic[] {
  if (points.length < 2) return [];
  const t1 = norm(sub(points[1], points[0]));
  const t2 = norm(sub(points[points.length - 2], points[points.length - 1]));
  return fitRange(points, t1, t2, error);
}

function fitRange(points: V[], leftTangent: V, rightTangent: V, error: number): Cubic[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length === 2) {
    const d = dist(first, last) / 3;
    return [[first, add(first, mul(leftTangent, d)), add(last, mul(rightTangent, d)), last]];
  }
  let u = chordLengths(points);
  let bez = generate(points, u, leftTangent, rightTangent);
  let [maxError, split] = maxDistance(points, bez, u);
  if (maxError < error) return [bez];
  if (maxError < error * 4) {
    for (let i = 0; i < 6; i++) {
      u = u.map((t, k) => newtonRoot(bez, points[k], t));
      bez = generate(points, u, leftTangent, rightTangent);
      [maxError, split] = maxDistance(points, bez, u);
      if (maxError < error) return [bez];
    }
  }
  const centre = norm(sub(points[split - 1], points[split + 1]));
  return [
    ...fitRange(points.slice(0, split + 1), leftTangent, centre, error),
    ...fitRange(points.slice(split), mul(centre, -1), rightTangent, error),
  ];
}

function chordLengths(points: V[]): number[] {
  const u = [0];
  for (let i = 1; i < points.length; i++) u.push(u[i - 1] + dist(points[i], points[i - 1]));
  const total = u[u.length - 1] || 1;
  return u.map((x) => x / total);
}

function bezierAt(b: Cubic, t: number): V {
  const s = 1 - t;
  return add(add(mul(b[0], s * s * s), mul(b[1], 3 * s * s * t)), add(mul(b[2], 3 * s * t * t), mul(b[3], t * t * t)));
}

function generate(points: V[], u: number[], t1: V, t2: V): Cubic {
  const first = points[0];
  const last = points[points.length - 1];
  const c = [[0, 0], [0, 0]];
  const x = [0, 0];
  u.forEach((t, i) => {
    const s = 1 - t;
    const a1 = mul(t1, 3 * s * s * t);
    const a2 = mul(t2, 3 * s * t * t);
    c[0][0] += dot(a1, a1); c[0][1] += dot(a1, a2); c[1][0] += dot(a1, a2); c[1][1] += dot(a2, a2);
    const tmp = sub(points[i], add(mul(first, s * s * s + 3 * s * s * t), mul(last, 3 * s * t * t + t * t * t)));
    x[0] += dot(a1, tmp); x[1] += dot(a2, tmp);
  });
  const det = c[0][0] * c[1][1] - c[1][0] * c[0][1];
  let alphaL = det === 0 ? 0 : (x[0] * c[1][1] - x[1] * c[0][1]) / det;
  let alphaR = det === 0 ? 0 : (c[0][0] * x[1] - c[1][0] * x[0]) / det;
  const seg = dist(first, last);
  const eps = 1e-6 * seg;
  if (alphaL < eps || alphaR < eps) alphaL = alphaR = seg / 3;
  return [first, add(first, mul(t1, alphaL)), add(last, mul(t2, alphaR)), last];
}

function maxDistance(points: V[], b: Cubic, u: number[]): [number, number] {
  let max = 0;
  let split = Math.floor(points.length / 2);
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist(bezierAt(b, u[i]), points[i]);
    if (d > max) { max = d; split = i; }
  }
  return [max, split];
}

function newtonRoot(b: Cubic, p: V, t: number): number {
  const d1: V[] = [mul(sub(b[1], b[0]), 3), mul(sub(b[2], b[1]), 3), mul(sub(b[3], b[2]), 3)];
  const d2: V[] = [mul(sub(d1[1], d1[0]), 2), mul(sub(d1[2], d1[1]), 2)];
  const q = sub(bezierAt(b, t), p);
  const s = 1 - t;
  const q1 = add(add(mul(d1[0], s * s), mul(d1[1], 2 * s * t)), mul(d1[2], t * t));
  const q2 = add(mul(d2[0], s), mul(d2[1], t));
  const den = dot(q1, q1) + dot(q, q2);
  if (den === 0) return t;
  return Math.min(1, Math.max(0, t - dot(q, q1) / den));
}

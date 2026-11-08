import type { DesignPath } from './scene';

/**
 * SVG path data as a drawn shape (the shape editor's outlines: points with curve handles), so the
 * assistant can draw any outline the shape editor could.
 *
 * <p>Reads M L H V C S Q T A Z, relative and absolute, with repeated arguments. Quadratic curves and
 * arcs become cubic ones. Every subpath is an outline of one shape; one that sits inside another is a
 * hole, whichever way it was drawn (outlines are wound so the non-zero fill reads them as the even-odd
 * rule would). The result is moved into its own box, starting at 0,0.</p>
 */

type P = { x: number; y: number };
type Point = { x: number; y: number; in?: P | null; out?: P | null };
type Contour = { closed: boolean; points: Point[] };

export class SvgPathError extends Error {}

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

export function pathFromSvg(d: string, maxPoints = 2000): DesignPath {
  const stray = d.replace(TOKEN, '').replace(/[\s,]/g, '');
  if (stray) throw new SvgPathError(`"${stray.slice(0, 12)}" isn't path data: use the commands M L H V C S Q T A Z and numbers.`);
  const tokens = d.match(TOKEN) ?? [];
  if (!tokens.length) throw new SvgPathError('The path is empty.');
  const contours: Contour[] = [];
  let current: Contour | null = null;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let lastCubic: P | null = null; // the previous segment's second handle, for S
  let lastQuad: P | null = null; // the previous quadratic control point, for T
  let i = 0;
  let cmd = '';

  const num = (): number => {
    const t = tokens[i];
    if (t === undefined || /[a-z]/i.test(t)) throw new SvgPathError(`"${cmd}" needs more numbers.`);
    i++;
    const v = Number(t);
    if (!Number.isFinite(v)) throw new SvgPathError(`"${t}" isn't a number.`);
    return v;
  };
  const start = (x: number, y: number) => {
    current = { closed: false, points: [{ x, y }] };
    contours.push(current);
    sx = x; sy = y;
  };
  const ensure = () => { if (!current) start(cx, cy); return current!; };
  const lineTo = (x: number, y: number) => { ensure().points.push({ x, y }); cx = x; cy = y; };
  const curveTo = (c1: P, c2: P, x: number, y: number) => {
    const c = ensure();
    c.points[c.points.length - 1].out = c1;
    c.points.push({ x, y, in: c2 });
    cx = x; cy = y;
  };

  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new SvgPathError('A path starts with a command, such as M.');
    const rel = cmd === cmd.toLowerCase();
    const k = cmd.toLowerCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    let quad: P | null = null;
    let cubic: P | null = null;
    switch (k) {
      case 'm': {
        const x = num() + ox, y = num() + oy;
        start(x, y);
        cx = x; cy = y;
        cmd = rel ? 'l' : 'L'; // further pairs are lines
        break;
      }
      case 'l': lineTo(num() + ox, num() + oy); break;
      case 'h': lineTo(num() + ox, cy); break;
      case 'v': lineTo(cx, num() + oy); break;
      case 'c': {
        const c1: P = { x: num() + ox, y: num() + oy }, c2: P = { x: num() + ox, y: num() + oy };
        curveTo(c1, c2, num() + ox, num() + oy);
        cubic = c2;
        break;
      }
      case 's': {
        const c1: P = lastCubic ? { x: 2 * cx - lastCubic.x, y: 2 * cy - lastCubic.y } : { x: cx, y: cy };
        const c2: P = { x: num() + ox, y: num() + oy };
        curveTo(c1, c2, num() + ox, num() + oy);
        cubic = c2;
        break;
      }
      case 'q': {
        const q: P = { x: num() + ox, y: num() + oy };
        const x = num() + ox, y = num() + oy;
        curveTo(lerp({ x: cx, y: cy }, q, 2 / 3), lerp({ x, y }, q, 2 / 3), x, y);
        quad = q;
        break;
      }
      case 't': {
        const q: P = lastQuad ? { x: 2 * cx - lastQuad.x, y: 2 * cy - lastQuad.y } : { x: cx, y: cy };
        const x = num() + ox, y = num() + oy;
        curveTo(lerp({ x: cx, y: cy }, q, 2 / 3), lerp({ x, y }, q, 2 / 3), x, y);
        quad = q;
        break;
      }
      case 'a': {
        const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
        const x = num() + ox, y = num() + oy;
        for (const [c1, c2, end] of arcToCubics(cx, cy, rx, ry, rot, large !== 0, sweep !== 0, x, y)) curveTo(c1, c2, end.x, end.y);
        if (cx !== x || cy !== y) lineTo(x, y);
        break;
      }
      case 'z': {
        const c = current as Contour | null;
        if (c) {
          c.closed = true;
          // Closing back onto the first point: that point is the same one, keep one copy with both handles.
          const first = c.points[0], last = c.points[c.points.length - 1];
          if (c.points.length > 1 && near(first, last)) {
            first.in = last.in ?? first.in;
            c.points.pop();
          }
        }
        cx = sx; cy = sy;
        current = null;
        break;
      }
      default:
        throw new SvgPathError(`"${cmd}" isn't a path command.`);
    }
    lastCubic = cubic;
    lastQuad = quad;
    if (ARGS[k] === undefined) throw new SvgPathError(`"${cmd}" isn't a path command.`);
    if (k === 'z') cmd = '';
  }

  const usable = contours.filter((c) => c.points.length >= 2);
  if (!usable.length) throw new SvgPathError('The path draws nothing: give it at least two points.');
  const count = usable.reduce((n, c) => n + c.points.length, 0);
  if (count > maxPoints) throw new SvgPathError(`That's ${count} points; a shape may have ${maxPoints}. Use curves for smooth parts.`);
  orient(usable);

  // Into its own box, from 0,0.
  // Measured on the curves themselves, not their handles, which reach past them.
  const all = usable.flatMap(extent);
  const minX = Math.min(...all.map((p) => p.x)), minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x)), maxY = Math.max(...all.map((p) => p.y));
  const r = (v: number) => Math.round(v * 100) / 100;
  const at = (p: P) => ({ x: r(p.x - minX), y: r(p.y - minY) });
  return {
    width: r(Math.max(1, maxX - minX)),
    height: r(Math.max(1, maxY - minY)),
    contours: usable.map((c) => ({
      closed: c.closed,
      points: c.points.map((p) => ({ ...at(p), ...(p.in ? { in: at(p.in) } : {}), ...(p.out ? { out: at(p.out) } : {}) })),
    })),
  };
}

/** The points that bound an outline: its anchors and each curve's furthest reach. */
function extent(c: Contour): P[] {
  const out: P[] = c.points.map((p) => ({ x: p.x, y: p.y }));
  const n = c.points.length;
  for (let i = 0; i < (c.closed ? n : n - 1); i++) {
    const a = c.points[i], b = c.points[(i + 1) % n];
    if (!a.out && !b.in) continue;
    const p1 = a.out ?? a, p2 = b.in ?? b;
    for (const t of [...roots(a.x, p1.x, p2.x, b.x), ...roots(a.y, p1.y, p2.y, b.y)]) out.push(bezier(a, p1, p2, b, t));
  }
  return out;
}

/** Where a cubic's derivative is zero inside (0, 1): its turning points along one axis. */
function roots(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
  const ts: number[] = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) ts.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) ts.push((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a));
  }
  return ts.filter((t) => t > 0 && t < 1);
}

function bezier(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const near = (a: P, b: P) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

/**
 * Winds closed outlines so the non-zero fill draws them the way the even-odd rule would: an outline
 * inside an odd number of others is a hole and runs the other way.
 */
function orient(contours: Contour[]): void {
  const closed = contours.filter((c) => c.closed && c.points.length >= 3);
  for (const c of closed) {
    const depth = closed.filter((o) => o !== c && inside(c.points[0], o.points)).length;
    const clockwise = area(c.points) > 0;
    if (clockwise !== (depth % 2 === 0)) reverse(c);
  }
}

function area(points: P[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function inside(p: P, ring: P[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function reverse(c: Contour): void {
  c.points = c.points.reverse().map((p) => ({ x: p.x, y: p.y, ...(p.out ? { in: p.out } : {}), ...(p.in ? { out: p.in } : {}) }));
}

/** An elliptical arc (SVG's endpoint form) as cubic curves, at most a quarter turn each. */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, x2: number, y2: number): [P, P, P][] {
  if ((x1 === x2 && y1 === y2) || rx === 0 || ry === 0) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / segments;
  const kappa = (4 / 3) * Math.tan(step / 4);
  const point = (t: number): P => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
  const deriv = (t: number): P => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
  const out: [P, P, P][] = [];
  for (let s = 0; s < segments; s++) {
    const a = t1 + s * step, b = a + step;
    const pa = point(a), pb = point(b), da = deriv(a), db = deriv(b);
    out.push([{ x: pa.x + kappa * da.x, y: pa.y + kappa * da.y }, { x: pb.x - kappa * db.x, y: pb.y - kappa * db.y }, s === segments - 1 ? { x: x2, y: y2 } : pb]);
  }
  return out;
}

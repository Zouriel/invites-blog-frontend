/**
 * Ready-made shapes with a setting or two (`DesignShapes` in C#; keep the two in step, byte for byte —
 * the parity corpus compares them). Each is an SVG path in a box of the element's size, so a shape
 * stretches with its box like the other shapes do. The same outlines clip pictures and groups (masks).
 *
 * <p>`sides` is the count (a star's points, a badge's scallops, a divider's waves or teeth) and
 * `amount` the one shape-specific setting, 0–1 (how deep a star's points go, how high the waves are,
 * how thick a frame is…).</p>
 */
import { num } from './css';

export const EXTRA_SHAPE_KINDS = ['star', 'heart', 'arch', 'ribbon', 'bubble', 'arrow', 'scallop', 'wave', 'zigzag', 'frame', 'ticket'] as const;
/** Outlines a picture, illustration or group can be clipped to. */
export const MASK_KINDS = ['ellipse', 'rect', 'polygon', 'star', 'heart', 'arch', 'scallop', 'ticket', 'bubble', 'ribbon', 'arrow'] as const;

export const isExtraShape = (kind: string | null | undefined): boolean => !!kind && (EXTRA_SHAPE_KINDS as readonly string[]).includes(kind);
export const isMaskKind = (kind: string | null | undefined): boolean => !!kind && (MASK_KINDS as readonly string[]).includes(kind);

/** What `amount` means for each kind, and its default (null: unused). */
export const SHAPE_AMOUNT: Record<string, { label: string; value: number } | undefined> = {
  star: { label: 'Point depth', value: 0.5 }, ribbon: { label: 'Notch', value: 0.5 }, bubble: { label: 'Tail position', value: 0.3 },
  arrow: { label: 'Shaft', value: 0.45 }, scallop: { label: 'Scallop depth', value: 0.12 }, wave: { label: 'Wave height', value: 0.35 },
  zigzag: { label: 'Tooth depth', value: 0.35 }, frame: { label: 'Thickness', value: 0.15 }, ticket: { label: 'Notch', value: 0.25 },
  rect: { label: 'Corners', value: 0.2 },
};
/** What `sides` counts for each kind, its default and range (null: unused). */
export const SHAPE_COUNT: Record<string, { label: string; value: number; min: number; max: number } | undefined> = {
  polygon: { label: 'Sides', value: 6, min: 3, max: 12 }, star: { label: 'Points', value: 5, min: 3, max: 24 },
  scallop: { label: 'Scallops', value: 14, min: 6, max: 40 }, wave: { label: 'Waves', value: 3, min: 1, max: 12 },
  zigzag: { label: 'Teeth', value: 8, min: 2, max: 40 },
};

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
const clampInt = (v: number, lo: number, hi: number) => clamp(Math.round(Number.isFinite(v) ? v : lo), lo, hi);

/** The kind's setting, held to its range (unset or not a number: the default). */
export function amountOf(kind: string, amount: number | null): number {
  const d = SHAPE_AMOUNT[kind]?.value ?? 0.5;
  return amount === null || !Number.isFinite(amount) ? d : Math.min(1, Math.max(0, amount));
}

/** The kind's count, held to its range. */
export function countOf(kind: string, sides: number): number {
  const c = SHAPE_COUNT[kind];
  return c ? clampInt(sides, c.min, c.max) : 0;
}

/**
 * The outline of a shape kind in a w × h box, `inset` in from every edge (half a stroke), as an SVG
 * path; null for a kind this doesn't draw. `radius` rounds a ticket's or bubble's corners and a frame's.
 */
export function shapeD(kind: string, w: number, h: number, sides: number, amount: number | null, radius: number, inset = 0): string | null {
  const n = num;
  const x0 = inset, y0 = inset, x1 = Math.max(inset, w - inset), y1 = Math.max(inset, h - inset);
  const W = x1 - x0, H = y1 - y0, cx = x0 + W / 2, cy = y0 + H / 2, rx = W / 2, ry = H / 2;
  const a = amountOf(kind, amount);
  const P = (x: number, y: number) => `${n(x)} ${n(y)}`;
  const rounded = (r: number, ax: number, ay: number, bx: number, by: number) => {
    // A rectangle from (ax, ay) to (bx, by) with corners of radius r, clockwise.
    const q = Math.max(0, Math.min(r, (bx - ax) / 2, (by - ay) / 2));
    if (q <= 0) return `M${P(ax, ay)}H${n(bx)}V${n(by)}H${n(ax)}Z`;
    return `M${P(ax + q, ay)}H${n(bx - q)}A${n(q)} ${n(q)} 0 0 1 ${P(bx, ay + q)}V${n(by - q)}A${n(q)} ${n(q)} 0 0 1 ${P(bx - q, by)}`
      + `H${n(ax + q)}A${n(q)} ${n(q)} 0 0 1 ${P(ax, by - q)}V${n(ay + q)}A${n(q)} ${n(q)} 0 0 1 ${P(ax + q, ay)}Z`;
  };
  const ring = (radiusAt: (k: number) => number, steps: number) => {
    let d = '';
    for (let k = 0; k < steps; k++) {
      const t = -Math.PI / 2 + (k * 2 * Math.PI) / steps;
      const r = radiusAt(k);
      d += (k === 0 ? 'M' : 'L') + P(cx + rx * r * Math.cos(t), cy + ry * r * Math.sin(t));
    }
    return d + 'Z';
  };
  switch (kind) {
    case 'rect': return rounded(a * Math.min(W, H) / 2, x0, y0, x1, y1);
    case 'ellipse': return `M${P(x0, cy)}A${n(rx)} ${n(ry)} 0 1 1 ${P(x1, cy)}A${n(rx)} ${n(ry)} 0 1 1 ${P(x0, cy)}Z`;
    case 'polygon': { const c = countOf('polygon', sides); return ring(() => 1, c); }
    case 'star': {
      const c = countOf('star', sides);
      const inner = Math.min(0.95, Math.max(0.05, 1 - a * 0.9));
      return ring((k) => (k % 2 === 0 ? 1 : inner), c * 2);
    }
    case 'heart': {
      const U = (u: number, v: number) => P(x0 + W * u, y0 + H * v);
      return `M${U(0.5, 0.25)}C${U(0.5, 0.1)} ${U(0.35, 0)} ${U(0.22, 0)}C${U(0.08, 0)} ${U(0, 0.12)} ${U(0, 0.28)}`
        + `C${U(0, 0.52)} ${U(0.25, 0.7)} ${U(0.5, 1)}C${U(0.75, 0.7)} ${U(1, 0.52)} ${U(1, 0.28)}`
        + `C${U(1, 0.12)} ${U(0.92, 0)} ${U(0.78, 0)}C${U(0.65, 0)} ${U(0.5, 0.1)} ${U(0.5, 0.25)}Z`;
    }
    case 'arch': {
      const t = Math.min(rx, H);
      return `M${P(x0, y1)}V${n(y0 + t)}A${n(rx)} ${n(t)} 0 0 1 ${P(x1, y0 + t)}V${n(y1)}Z`;
    }
    case 'ribbon': {
      const d = a * Math.min(W / 2, H);
      return `M${P(x0, y0)}H${n(x1)}L${P(x1 - d, cy)}L${P(x1, y1)}H${n(x0)}L${P(x0 + d, cy)}Z`;
    }
    case 'bubble': {
      const yb = y0 + H * 0.8;
      const q = Math.max(0, Math.min(radius, W / 2, (yb - y0) / 2));
      const tx = x0 + W * (0.1 + 0.8 * a);
      const tw = Math.min(W * 0.12, (yb - y0));
      const left = Math.max(x0 + q, tx - tw / 2), right = Math.min(x1 - q, tx + tw / 2);
      return `M${P(x0 + q, y0)}H${n(x1 - q)}A${n(q)} ${n(q)} 0 0 1 ${P(x1, y0 + q)}V${n(yb - q)}A${n(q)} ${n(q)} 0 0 1 ${P(x1 - q, yb)}`
        + `H${n(right)}L${P(tx - tw / 2, y1)}L${P(left, yb)}H${n(x0 + q)}A${n(q)} ${n(q)} 0 0 1 ${P(x0, yb - q)}V${n(y0 + q)}A${n(q)} ${n(q)} 0 0 1 ${P(x0 + q, y0)}Z`;
    }
    case 'arrow': {
      const t = H * Math.min(0.95, Math.max(0.1, a));
      const hl = Math.min(W * 0.45, H * 0.8);
      return `M${P(x0, cy - t / 2)}H${n(x1 - hl)}V${n(y0)}L${P(x1, cy)}L${P(x1 - hl, y1)}V${n(cy + t / 2)}H${n(x0)}Z`;
    }
    case 'scallop': {
      const c = countOf('scallop', sides);
      const depth = Math.min(0.4, Math.max(0.02, a));
      const valley = 1 - 2 * depth;
      const control = 2 - valley * Math.cos(Math.PI / c);
      let d = '';
      for (let k = 0; k <= c; k++) {
        const t = -Math.PI / 2 + (k * 2 * Math.PI) / c;
        const v = P(cx + rx * valley * Math.cos(t), cy + ry * valley * Math.sin(t));
        if (k === 0) { d += `M${v}`; continue; }
        const m = t - Math.PI / c;
        d += `Q${P(cx + rx * control * Math.cos(m), cy + ry * control * Math.sin(m))} ${v}`;
      }
      return d + 'Z';
    }
    case 'wave': {
      const c = countOf('wave', sides);
      const A = (H * Math.min(1, Math.max(0.02, a))) / 2;
      const yb = y0 + A;
      const ww = W / c;
      let d = `M${P(x0, yb)}Q${P(x0 + ww / 4, yb - 2 * A)} ${P(x0 + ww / 2, yb)}`;
      for (let k = 2; k <= 2 * c; k++) d += `T${P(x0 + (k * ww) / 2, yb)}`;
      return d + `V${n(y1)}H${n(x0)}Z`;
    }
    case 'zigzag': {
      const c = countOf('zigzag', sides);
      const A = H * Math.min(1, Math.max(0.02, a));
      const tw = W / c;
      let d = `M${P(x0, y0 + A)}`;
      for (let k = 0; k < c; k++) d += `L${P(x0 + (k + 0.5) * tw, y0)}L${P(x0 + (k + 1) * tw, y0 + A)}`;
      return d + `V${n(y1)}H${n(x0)}Z`;
    }
    case 'frame': {
      const t = Math.max(1, (a * Math.min(W, H)) / 2);
      return rounded(radius, x0, y0, x1, y1) + rounded(Math.max(0, radius - t), x0 + t, y0 + t, x1 - t, y1 - t);
    }
    case 'ticket': {
      const nr = Math.min((a * H) / 2, H / 2 - 1, W / 4);
      const q = Math.max(0, Math.min(radius, W / 2, H / 2 - nr));
      const N = Math.max(0, nr);
      return `M${P(x0 + q, y0)}H${n(x1 - q)}A${n(q)} ${n(q)} 0 0 1 ${P(x1, y0 + q)}V${n(cy - N)}A${n(N)} ${n(N)} 0 0 0 ${P(x1, cy + N)}`
        + `V${n(y1 - q)}A${n(q)} ${n(q)} 0 0 1 ${P(x1 - q, y1)}H${n(x0 + q)}A${n(q)} ${n(q)} 0 0 1 ${P(x0, y1 - q)}`
        + `V${n(cy + N)}A${n(N)} ${n(N)} 0 0 0 ${P(x0, cy - N)}V${n(y0 + q)}A${n(q)} ${n(q)} 0 0 1 ${P(x0 + q, y0)}Z`;
    }
    default: return null;
  }
}

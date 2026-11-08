/**
 * Layer effects on an element, as Photoshop's layer styles do them (`DesignEffects` in C#; keep the two
 * in step, byte for byte — the parity corpus compares them):
 *
 * <ul>
 *   <li><b>bevel</b>: the outline's edge lit from the top left, raised out of the page or pressed into it;</li>
 *   <li><b>inner glow</b>: a colour glowing in from the edges, laid over what it paints in a blend mode;</li>
 *   <li><b>outer glow</b>: a colour glowing out around it, behind it;</li>
 *   <li><b>blend</b>: how the whole element mixes with what is under it (CSS mix-blend-mode).</li>
 * </ul>
 *
 * <p>Bevel and glows are one SVG filter together with the element's pattern, applied in Photoshop's
 * order: pattern, inner glow, bevel, then the outer glow underneath. They work on whatever the
 * element paints, after its colours and tint, so a tinted illustration or a word gets them too.</p>
 */
import { num } from './css';
import { patternFilter, patternPrimitives, type ResolvedPattern } from './patterns';

/** CSS blend modes, the same names in mix-blend-mode, feBlend and a canvas's globalCompositeOperation. */
export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
] as const;
export const BEVEL_STYLES = ['raised', 'pressed'] as const;
export const BEVEL_MIN_SIZE = 1;
export const BEVEL_MAX_SIZE = 30;
export const GLOW_MIN_SIZE = 1;
export const GLOW_MAX_SIZE = 60;

export const isBlendMode = (mode: string | null | undefined): mode is string => !!mode && (BLEND_MODES as readonly string[]).includes(mode);

export interface ResolvedBevel { style: string; size: number; strength: number }
export interface ResolvedGlow { size: number; strength: number; blend: string }

type RawBevel = { style: string | null; size: number; strength: number } | null;
type RawGlow = { size: number; strength: number; blend: string | null } | null;

const strengthOf = (v: number, fallback: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);
const sizeOf = (v: number, min: number, max: number, fallback: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** A bevel as the compiler uses it, or null when there is none to draw. */
export function resolveBevel(b: RawBevel): ResolvedBevel | null {
  if (!b) return null;
  const strength = strengthOf(b.strength, 0.7);
  if (strength <= 0) return null;
  const style = b.style === 'pressed' ? 'pressed' : 'raised';
  return { style, size: sizeOf(b.size, BEVEL_MIN_SIZE, BEVEL_MAX_SIZE, 4), strength };
}

/** A glow as the compiler uses it, or null when there is none to draw. */
export function resolveGlow(g: RawGlow, defaultBlend: string): ResolvedGlow | null {
  if (!g) return null;
  const strength = strengthOf(g.strength, 0.75);
  if (strength <= 0) return null;
  return { size: sizeOf(g.size, GLOW_MIN_SIZE, GLOW_MAX_SIZE, 10), strength, blend: isBlendMode(g.blend) ? g.blend : defaultBlend };
}

export interface FilterParts {
  pattern: { p: ResolvedPattern; colour: string | null } | null;
  bevel: ResolvedBevel | null;
  inner: { g: ResolvedGlow; colour: string } | null;
  outer: { g: ResolvedGlow; colour: string } | null;
}

/** A glow's spread: blurred alpha, doubled so the edge reads at full strength. */
const spread = (size: number, input: string, result: string) =>
  `<feGaussianBlur${input ? ` in="${input}"` : ''} stdDeviation="${num(size / 2)}"/><feComponentTransfer result="${result}"><feFuncA type="linear" slope="2"/></feComponentTransfer>`;

/**
 * The page's filter for an element's pattern and effects (canvas units for its box), or null when it
 * has none. A pattern on its own is exactly the pattern's filter.
 */
export function elementFilter(id: string, parts: FilterParts, w: number, h: number): string | null {
  const { pattern, bevel, inner, outer } = parts;
  if (!bevel && !inner && !outer) return pattern ? patternFilter(id, pattern.p, w, h, pattern.colour) : null;

  let body = '';
  let cur = 'SourceGraphic';
  if (pattern) {
    const steps = patternPrimitives(pattern.p, w, h, pattern.colour);
    body += steps.slice(0, -2) + ' result="p"/>';
    cur = 'p';
  }
  if (inner) {
    // The outside, blurred in over the edge and kept inside: a glow from the rim inwards.
    body += '<feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>'
      + spread(inner.g.size, '', 'ib') + '<feComposite in2="SourceAlpha" operator="in" result="ia"/>'
      + `<feFlood style="flood-color:${inner.colour}" flood-opacity="${num(inner.g.strength)}"/><feComposite in2="ia" operator="in"/>`
      + `<feBlend in2="${cur}" mode="${inner.g.blend}" result="ig"/>`;
    cur = 'ig';
  }
  if (bevel) {
    // The outline blurred into a slope and lit from the top left; grey where it is flat leaves the
    // colour as it is under hard light, so only the edge changes.
    const depth = bevel.size * 1.25 * (bevel.style === 'pressed' ? -1 : 1);
    body += `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(bevel.size / 2)}"/>`
      + `<feDiffuseLighting surfaceScale="${num(depth)}" diffuseConstant="0.7071" lighting-color="#fff"><feDistantLight azimuth="225" elevation="45"/></feDiffuseLighting>`
      + `<feBlend in2="${cur}" mode="hard-light"/>`
      + `<feComposite in2="${cur}" operator="arithmetic" k2="${num(bevel.strength)}" k3="${num(1 - bevel.strength)}"/>`
      + `<feComposite in2="${cur}" operator="in" result="bv"/>`;
    cur = 'bv';
  }
  if (outer) {
    body += spread(outer.g.size, 'SourceAlpha', 'oa')
      + `<feFlood style="flood-color:${outer.colour}" flood-opacity="${num(outer.g.strength)}"/><feComposite in2="oa" operator="in"/>`
      + `<feMerge><feMergeNode/><feMergeNode in="${cur}"/></feMerge>`;
  }
  // Room around the box for the glow (and for a blur that reaches past the edge), at least the
  // pattern's own margins.
  const reach = Math.max(outer ? outer.g.size * 1.5 : 0, inner ? inner.g.size : 0, bevel ? bevel.size : 0);
  const mx = Math.max(10, (100 * reach) / Math.max(1, w));
  const my = Math.max(25, (100 * reach) / Math.max(1, h));
  return `<filter id="${id}" x="${num(-mx)}%" y="${num(-my)}%" width="${num(100 + 2 * mx)}%" height="${num(100 + 2 * my)}%" color-interpolation-filters="sRGB">${body}</filter>`;
}

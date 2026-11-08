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
 * order: a picture's duotone and grain, pattern, inner glow, bevel, then the drop shadow and outer glow
 * underneath. They work on whatever the
 * element paints, after its colours and tint, so a tinted illustration or a word gets them too.</p>
 */
import { num } from './css';
import { lighting, patternFilter, patternPrimitives, type ResolvedLight, type ResolvedPattern } from './patterns';

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
export const SHADOW_MAX_OFFSET = 60;
export const SHADOW_MAX_BLUR = 60;

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
  /** A picture's two-colour look: shadows in `dark`, highlights in `light`. */
  duotone?: { dark: string; light: string } | null;
  /** Film grain, 0–1. */
  grain?: number;
  shadow?: ResolvedShadow | null;
  /** Where the bevel's (and an embossed pattern's) light comes from, and its colour. */
  light?: ResolvedLight | null;
}

export interface ResolvedShadow { x: number; y: number; blur: number; strength: number; colour: string }

/** A shadow as the compiler uses it, or null when there is none to draw. */
export function resolveShadow(sh: { x: number; y: number; blur: number; strength: number } | null, colour: string): ResolvedShadow | null {
  if (!sh) return null;
  const strength = strengthOf(sh.strength, 0.35);
  if (strength <= 0) return null;
  const off = (v: number, d: number) => (Number.isFinite(v) ? Math.min(SHADOW_MAX_OFFSET, Math.max(-SHADOW_MAX_OFFSET, v)) : d);
  return { x: off(sh.x, 0), y: off(sh.y, 4), blur: sizeOf(sh.blur, 0, SHADOW_MAX_BLUR, 8), strength, colour };
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
  const duotone = parts.duotone ?? null;
  const grain = Number.isFinite(parts.grain) ? Math.min(1, Math.max(0, parts.grain!)) : 0;
  const shadow = parts.shadow ?? null;
  const light = parts.light ?? null;
  if (!bevel && !inner && !outer && !duotone && grain <= 0 && !shadow) return pattern ? patternFilter(id, pattern.p, w, h, pattern.colour, light) : null;

  let body = '';
  let cur = 'SourceGraphic';
  if (duotone) {
    // Brightness becomes how much of the light colour shows over the dark one.
    body += '<feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="dl"/>'
      + `<feFlood style="flood-color:${duotone.dark}"/><feComposite in2="SourceAlpha" operator="in" result="dd"/>`
      + `<feFlood style="flood-color:${duotone.light}"/><feComposite in2="dl" operator="in"/><feComposite in2="SourceAlpha" operator="in"/>`
      + '<feComposite in2="dd" operator="over" result="dt"/>';
    cur = 'dt';
  }
  if (grain > 0) {
    // Grey noise, soft-lit over the picture and kept to it.
    body += '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11"/>'
      + '<feColorMatrix values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1"/>'
      + `<feBlend in2="${cur}" mode="soft-light"/>`
      + `<feComposite in2="${cur}" operator="arithmetic" k2="${num(grain)}" k3="${num(1 - grain)}"/>`
      + `<feComposite in2="${cur}" operator="in" result="gr"/>`;
    cur = 'gr';
  }
  if (pattern) {
    const steps = patternPrimitives(pattern.p, w, h, pattern.colour, light).replaceAll('"SourceGraphic"', `"${cur}"`);
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
      + lighting(null, depth, light, null)
      + `<feBlend in2="${cur}" mode="hard-light"/>`
      + `<feComposite in2="${cur}" operator="arithmetic" k2="${num(bevel.strength)}" k3="${num(1 - bevel.strength)}"/>`
      + `<feComposite in2="${cur}" operator="in" result="bv"/>`;
    cur = 'bv';
  }
  const under: string[] = [];
  if (shadow) {
    body += `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(shadow.blur / 2)}"/><feOffset dx="${num(shadow.x)}" dy="${num(shadow.y)}" result="sa"/>`
      + `<feFlood style="flood-color:${shadow.colour}" flood-opacity="${num(shadow.strength)}"/><feComposite in2="sa" operator="in" result="sh"/>`;
    under.push('sh');
  }
  if (outer) {
    body += spread(outer.g.size, 'SourceAlpha', 'oa')
      + `<feFlood style="flood-color:${outer.colour}" flood-opacity="${num(outer.g.strength)}"/><feComposite in2="oa" operator="in" result="og"/>`;
    under.push('og');
  }
  if (under.length) body += `<feMerge>${under.map((r) => `<feMergeNode in="${r}"/>`).join('')}<feMergeNode in="${cur}"/></feMerge>`;
  // Room around the box for the glow (and for a blur that reaches past the edge), at least the
  // pattern's own margins.
  const reach = Math.max(outer ? outer.g.size * 1.5 : 0, inner ? inner.g.size : 0, bevel ? bevel.size : 0,
    shadow ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) + shadow.blur * 1.5 : 0);
  const mx = Math.max(10, (100 * reach) / Math.max(1, w));
  const my = Math.max(25, (100 * reach) / Math.max(1, h));
  return `<filter id="${id}" x="${num(-mx)}%" y="${num(-my)}%" width="${num(100 + 2 * mx)}%" height="${num(100 + 2 * my)}%" color-interpolation-filters="sRGB">${body}</filter>`;
}

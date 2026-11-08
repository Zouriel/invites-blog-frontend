/**
 * Patterns laid over whatever an element draws (`DesignPatterns` in C#; keep the two in step, byte for
 * byte — the parity corpus compares them).
 *
 * <p>A pattern is a map of marks (where the clouds, dots or stripes are) used the way Photoshop's
 * Pattern Overlay or a texture layer is: the marks are clipped to the element's own outline, so only
 * what it paints gets them, and they are applied in one of five ways:</p>
 *
 * <ul>
 *   <li><b>shade</b>: the marks darken the colour (black over it at the strength);</li>
 *   <li><b>shine</b>: the marks lighten it (white over it);</li>
 *   <li><b>colour</b>: the marks are painted in a second colour;</li>
 *   <li><b>emboss</b> / <b>engrave</b>: the marks are raised out of, or pressed into, the surface,
 *       lit from the top left.</li>
 * </ul>
 *
 * <p>Textures (clouds, marble, paper…) are Perlin noise made by the browser (feTurbulence) with a
 * contrast curve; the geometric ones are a tiled SVG drawn once over the element's box. Sizes are in
 * canvas units at a 390-wide phone: a pattern doesn't grow with a wider screen.</p>
 */
import { num } from './css';

export const PATTERN_TEXTURES = ['clouds', 'marble', 'paper', 'linen', 'sand', 'watercolour', 'wood'] as const;
export const PATTERN_SHAPES = ['dots', 'stripes', 'pinstripe', 'gingham', 'grid', 'chevron', 'diamonds', 'waves', 'hearts', 'stars'] as const;
export const PATTERN_KINDS: readonly string[] = [...PATTERN_TEXTURES, ...PATTERN_SHAPES];
export const PATTERN_MODES = ['shade', 'shine', 'colour', 'emboss', 'engrave'] as const;
export const PATTERN_MIN_SIZE = 0.25;
export const PATTERN_MAX_SIZE = 4;

export const isPatternKind = (kind: string | null | undefined): kind is string => !!kind && PATTERN_KINDS.includes(kind);
const isTexture = (kind: string) => (PATTERN_TEXTURES as readonly string[]).includes(kind);

/** A frequency given per thousand units, at a size: exact in either language, however small. */
const freq = (perThousand: number, size: number) => `${num(perThousand / size)}e-3`;

const matrix = (gain: number, offset: number) => `<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${num(gain)} 0 0 0 ${num(offset)}" result="m"/>`;

/** The filter steps that leave a texture's marks as the alpha of result "m" (black elsewhere). */
export function texturePrimitives(kind: string, size: number): string {
  const turb = (type: string, fx: number, fy: number, octaves: number, seed: number, result = '') =>
    `<feTurbulence type="${type}" baseFrequency="${freq(fx, size)}${fy === fx ? '' : ' ' + freq(fy, size)}" numOctaves="${octaves}" seed="${seed}"${result ? ` result="${result}"` : ''}/>`;
  switch (kind) {
    case 'clouds': return turb('fractalNoise', 9, 9, 4, 2) + matrix(2.8, -1.05);
    case 'marble': return turb('turbulence', 10, 30, 5, 5) + matrix(-6, 1.45);
    case 'paper': return turb('fractalNoise', 700, 700, 3, 1) + matrix(2.2, -0.85);
    case 'linen':
      return turb('fractalNoise', 500, 25, 2, 3, 'h') + turb('fractalNoise', 25, 500, 2, 8, 'v')
        + '<feComposite in="h" in2="v" operator="arithmetic" k2="0.5" k3="0.5"/>' + matrix(4, -1.7);
    case 'sand': return turb('fractalNoise', 450, 450, 1, 4) + matrix(10, -6);
    case 'watercolour': return turb('fractalNoise', 12, 12, 5, 7) + matrix(4.5, -1.9);
    default: return turb('fractalNoise', 6, 140, 3, 6) + matrix(3.4, -1.5); // wood
  }
}

/** One tile of a geometric pattern at a size: its width, height, rotation and black marks. */
function tile(kind: string, size: number): { w: number; h: number; turn: boolean; marks: string } {
  const S = 24 * size;
  const n = num;
  switch (kind) {
    case 'dots': return { w: S, h: S, turn: false, marks: `<circle cx="${n(S / 4)}" cy="${n(S / 4)}" r="${n(S * 0.1)}"/><circle cx="${n(S * 0.75)}" cy="${n(S * 0.75)}" r="${n(S * 0.1)}"/>` };
    case 'stripes': return { w: S, h: S, turn: true, marks: `<rect width="${n(S * 0.35)}" height="${n(S)}"/>` };
    case 'pinstripe': return { w: S, h: S, turn: false, marks: `<rect width="${n(Math.max(1, S * 0.05))}" height="${n(S)}"/>` };
    case 'gingham': return { w: S, h: S, turn: false, marks: `<rect width="${n(S)}" height="${n(S / 2)}" fill-opacity="0.5"/><rect width="${n(S / 2)}" height="${n(S)}" fill-opacity="0.5"/>` };
    case 'grid': {
      const lw = n(Math.max(1, S * 0.04));
      return { w: S, h: S, turn: false, marks: `<rect width="${n(S)}" height="${lw}"/><rect width="${lw}" height="${n(S)}"/>` };
    }
    case 'chevron': {
      const h = S / 2, lo = n(h * 0.8), hi = n(h * 0.2);
      return { w: S, h, turn: false, marks: `<path d="M${n(-S / 2)} ${lo}L0 ${hi}L${n(S / 2)} ${lo}L${n(S)} ${hi}L${n(S * 1.5)} ${lo}" fill="none" stroke="#000" stroke-width="${n(S * 0.08)}"/>` };
    }
    case 'diamonds': return { w: S, h: S, turn: false, marks: `<path d="M${n(S / 2)} 0L${n(S)} ${n(S / 2)}L${n(S / 2)} ${n(S)}L0 ${n(S / 2)}Z" fill="none" stroke="#000" stroke-width="${n(S * 0.05)}"/>` };
    case 'waves': {
      const h = S / 2, mid = n(h / 2);
      return { w: S, h, turn: false, marks: `<path d="M0 ${mid}Q${n(S / 4)} 0 ${n(S / 2)} ${mid}T${n(S)} ${mid}" fill="none" stroke="#000" stroke-width="${n(S * 0.06)}"/>` };
    }
    case 'hearts': return { w: S, h: S, turn: false, marks: `<path transform="translate(${n(S / 2)} ${n(S / 2)}) scale(${n(S / 55)})" d="M0 9C-18-3-9-18 0-7C9-18 18-3 0 9Z"/>` };
    default: return { w: S, h: S, turn: false, marks: `<path transform="translate(${n(S / 2)} ${n(S / 2)}) scale(${n(S / 42)})" d="M0-10L2.9-4L9.5-3.1L4.8 1.5L5.9 8.1L0 5L-5.9 8.1L-4.8 1.5L-9.5-3.1L-2.9-4Z"/>` }; // stars
  }
}

/** A standalone SVG of a geometric pattern's marks over a box (canvas units): black on transparent. */
export function shapeMarksSvg(kind: string, size: number, x: number, y: number, w: number, h: number): string {
  const t = tile(kind, size);
  const box = `x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(h)}" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}">`
    + `<defs><pattern id="p" width="${num(t.w)}" height="${num(t.h)}" patternUnits="userSpaceOnUse"${t.turn ? ' patternTransform="rotate(45)"' : ''}>${t.marks}</pattern></defs>`
    + `<rect ${box} fill="url(#p)"/></svg>`;
}

/** Any pattern's marks over a box as a standalone SVG (the poster draws it; the page uses filters). */
export function marksSvg(kind: string, size: number, x: number, y: number, w: number, h: number): string {
  if (!isTexture(kind)) return shapeMarksSvg(kind, size, x, y, w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(h)}" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}">`
    + `<filter id="f" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">${texturePrimitives(kind, size)}</filter>`
    + `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" filter="url(#f)"/></svg>`;
}

export interface ResolvedPattern { kind: string; mode: string; size: number; strength: number }

/** A pattern as the compiler uses it, or null when there is none to draw. */
export function resolvePattern(p: { kind: string | null; mode: string | null; size: number; strength: number } | null): ResolvedPattern | null {
  if (!p || !isPatternKind(p.kind)) return null;
  const strength = Number.isFinite(p.strength) ? Math.min(1, Math.max(0, p.strength)) : 0.5;
  if (strength <= 0) return null;
  const size = Number.isFinite(p.size) ? Math.min(PATTERN_MAX_SIZE, Math.max(PATTERN_MIN_SIZE, p.size)) : 1;
  const mode = p.mode !== null && (PATTERN_MODES as readonly string[]).includes(p.mode) ? p.mode : 'shade';
  return { kind: p.kind, mode, size, strength };
}

/**
 * The page's filter for a pattern on an element of a size (canvas units). `colour` is a CSS colour
 * (hex or var()) for the "colour" way; the others pick their own.
 */
export function patternFilter(id: string, p: ResolvedPattern, w: number, h: number, colour: string | null): string {
  return `<filter id="${id}" x="-10%" y="-25%" width="120%" height="150%" color-interpolation-filters="sRGB">${patternPrimitives(p, w, h, colour)}</filter>`;
}

/** The filter steps of a pattern over SourceGraphic, the last one being the patterned result. */
export function patternPrimitives(p: ResolvedPattern, w: number, h: number, colour: string | null): string {
  let marks: string;
  if (isTexture(p.kind)) marks = texturePrimitives(p.kind, p.size);
  else {
    // Drawn over more than the box: a phone wider than 390 shows the element bigger, and the filter
    // reaches a little past the box for anything that overflows it.
    const W = Math.max(1, w), H = Math.max(1, h);
    const x = -W / 4, y = -H / 4, bw = W * 1.75, bh = H * 1.75;
    marks = `<feImage href="data:image/svg+xml;base64,${btoa(shapeMarksSvg(p.kind, p.size, x, y, bw, bh))}" x="${num(x)}" y="${num(y)}" width="${num(bw)}" height="${num(bh)}" preserveAspectRatio="none" result="m"/>`;
  }
  let apply: string;
  if (p.mode === 'emboss' || p.mode === 'engrave') {
    const depth = (isTexture(p.kind) ? 10 : 3) * (p.mode === 'emboss' ? 1 : -1);
    apply = `<feDiffuseLighting in="m" surfaceScale="${num(depth)}" diffuseConstant="0.7071" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="45"/></feDiffuseLighting>`
      + '<feBlend in="l" in2="SourceGraphic" mode="hard-light"/>'
      + `<feComposite in2="SourceGraphic" operator="arithmetic" k2="${num(p.strength)}" k3="${num(1 - p.strength)}"/>`
      + '<feComposite in2="SourceAlpha" operator="in"/>';
  } else {
    const c = p.mode === 'shine' ? '#ffffff' : p.mode === 'colour' && colour !== null ? colour : '#000000';
    apply = `<feFlood style="flood-color:${c}" flood-opacity="${num(p.strength)}"/><feComposite in2="m" operator="in"/><feComposite in2="SourceGraphic" operator="atop"/>`;
  }
  return marks + apply;
}

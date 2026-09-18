/**
 * The C# compiler's string helpers (`DesignCss`, `WebUtility.HtmlEncode`, `DesignCompiler.Slug`),
 * reproduced to the byte. The browser renderer and the server must produce the same page, so every
 * number, colour and escaped character goes through exactly the same rules here as there.
 */

export interface RenderCatalog {
  fonts: readonly { id: string; name: string; stack: string; weights: readonly number[] }[];
  variables: readonly { path: string; label: string; kind: string; type: string; sample: string }[];
  easings: readonly string[];
  fieldTypes: readonly string[];
  linkPaths: readonly string[];
}

// ----- Limits (DesignCatalog) -----

export const LIMITS = {
  maxPageHeight: 84_400,
  maxKeyframes: 24,
  maxLift: 99,
  maxPathContours: 200,
  maxPathPoints: 2000,
  maxGalleryIndex: 50,
  maxTextLength: 4000,
} as const;

export const CANVAS_W = 390;
export const REFERENCE_VIEWPORT = 844;
export const ELEMENT_TYPES: readonly string[] = ['text', 'shape', 'svg', 'image', 'slot', 'rsvp', 'link', 'dress', 'group'];

// ----- Numbers -----

/** Round to the nearest integer, ties to even — what .NET's `Math.Round(double)` does. */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * A number as the server writes it into CSS: `Math.Round(v, 3)` (ties to even), then `"0.###"`
 * in the invariant culture; never NaN, never "-0".
 */
export function num(value: number): string {
  if (!Number.isFinite(value)) value = 0;
  if (Math.abs(value) >= 1e15) {
    // Beyond what the editor produces; .NET keeps 15 significant digits here.
    const s = Number(value.toPrecision(15));
    return s === 0 ? '0' : String(Math.round(s));
  }
  const k = roundHalfEven(value * 1000);
  if (k === 0) return '0';
  const neg = k < 0;
  const abs = Math.abs(k);
  const int = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + int + (frac ? '.' + frac : '');
}

/** A length in canvas units: `calc(N * var(--u))`. */
export function u(units: number): string {
  return units === 0 ? '0px' : `calc(${num(units)} * var(--u))`;
}

export function clamp(value: number, min: number, max: number): number {
  return Number.isNaN(value) ? min : Math.min(max, Math.max(min, value));
}

/** `Math.Clamp` on an int. */
export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ----- Text -----

/**
 * `System.Net.WebUtility.HtmlEncode`: the five specials, Latin-1 supplement characters (160–255) as
 * numeric entities, characters beyond the BMP as numeric entities, and a lone surrogate as U+FFFD.
 */
export function htmlEncode(value: string | null | undefined): string {
  if (value == null) return '';
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    if (ch <= 0x3e) {
      switch (ch) {
        case 0x3c: out += '&lt;'; break;
        case 0x3e: out += '&gt;'; break;
        case 0x22: out += '&quot;'; break;
        case 0x27: out += '&#39;'; break;
        case 0x26: out += '&amp;'; break;
        default: out += value[i];
      }
      continue;
    }
    if (ch >= 160 && ch < 256) { out += `&#${ch};`; continue; }
    if (ch >= 0xd800 && ch <= 0xdfff) {
      const next = value.charCodeAt(i + 1);
      if (ch <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        out += `&#${(ch - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000};`;
        i++;
      } else {
        out += '\uFFFD';
      }
      continue;
    }
    out += value[i];
  }
  return out;
}

/** `char.IsWhiteSpace`: JS's `\s` plus U+0085, minus the byte-order mark. */
const isWs = (ch: string) => ch !== '\uFEFF' && /[\s\u0085]/.test(ch);

/** `string.IsNullOrWhiteSpace`. */
export function blank(value: string | null | undefined): boolean {
  if (value == null) return true;
  for (const ch of value) if (!isWs(ch)) return false;
  return true;
}

/** .NET `string.Trim()`. */
export function trim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isWs(value[start])) start++;
  while (end > start && isWs(value[end - 1])) end--;
  return value.slice(start, end);
}

export function truncate(value: string, max: number = LIMITS.maxTextLength): string {
  return value.length <= max ? value : value.slice(0, max);
}

const isAsciiLetterOrDigit = (ch: string) => /^[A-Za-z0-9]$/.test(ch);

/** Lowercase slug of letters, digits and dashes; with `camel`, a camelCase key instead. */
export function slug(value: string, camel = false): string {
  let sb = '';
  let upperNext = false;
  for (const ch of trim(value)) {
    if (ch.length === 1 && isAsciiLetterOrDigit(ch)) {
      if (camel) sb += upperNext && sb.length > 0 ? ch.toUpperCase() : sb.length === 0 ? ch.toLowerCase() : ch;
      else sb += ch.toLowerCase();
      upperNext = false;
    } else if (camel) {
      upperNext = true;
    } else if (sb.length > 0 && sb[sb.length - 1] !== '-') {
      sb += '-';
    }
    if (sb.length >= 40) break;
  }
  return sb.replace(/^-+|-+$/g, '');
}

// ----- Colours, fonts, easing -----

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const THEME_KEY = /^[a-z][a-z0-9-]{0,31}$/;
const BEZIER = /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/;

export const isHex = (value: string | null | undefined): value is string => value != null && HEX.test(value);
export const isThemeKey = (key: string | null | undefined): key is string => key != null && THEME_KEY.test(key);

export function color(reference: string | null | undefined, themeKeys: ReadonlySet<string>): string | null {
  if (blank(reference)) return null;
  const ref = reference!;
  if (ref === 'none' || ref === 'transparent') return 'transparent';
  if (ref.startsWith('theme:')) {
    const key = ref.slice(6);
    return isThemeKey(key) && themeKeys.has(key) ? `var(--ib-${key})` : null;
  }
  return isHex(ref) ? ref.toLowerCase() : null;
}

export function font(reference: string | null | undefined, themeKeys: ReadonlySet<string>, catalog: RenderCatalog): string | null {
  if (blank(reference)) return null;
  const ref = reference!;
  if (ref.startsWith('theme:')) {
    const key = ref.slice(6);
    return isThemeKey(key) && themeKeys.has(key) ? `var(--ib-${key})` : null;
  }
  return findFont(catalog, ref)?.stack ?? null;
}

export function easing(value: string | null | undefined, catalog: RenderCatalog): string | null {
  if (blank(value)) return null;
  const v = trim(value!);
  if (catalog.easings.includes(v)) return v;
  const m = BEZIER.exec(v);
  if (!m) return null;
  const p = [1, 2, 3, 4].map((i) => Number(m[i]));
  if (p[0] < 0 || p[0] > 1 || p[2] < 0 || p[2] > 1) return null;
  return `cubic-bezier(${num(p[0])},${num(p[1])},${num(p[2])},${num(p[3])})`;
}

export function findFont(catalog: RenderCatalog, id: string | null | undefined) {
  return id == null ? undefined : catalog.fonts.find((f) => f.id === id);
}

export function findVariable(catalog: RenderCatalog, path: string) {
  return catalog.variables.find((v) => v.path === path);
}

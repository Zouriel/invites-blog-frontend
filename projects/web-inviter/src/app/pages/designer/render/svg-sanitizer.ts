/**
 * The C# `SvgSanitizer`, for the browser renderer. Same allowlist, same rewriting, same output — an
 * illustration looks identical in the editor's preview and on the published page.
 *
 * <p>XML is read with the browser's XML parser. Where the two XML models differ, this follows the
 * server's (`XDocument`): comments and processing instructions don't exist, and text that is only
 * whitespace doesn't either.</p>
 */
import { htmlEncode, num, trim as trimNet } from './css';

export interface SanitizedSvg {
  viewBox: string;
  innerMarkup: string;
  colors: string[];
  width: number;
  height: number;
}

export class SvgRejected extends Error {}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const MAX_NODES = 8000;
const MAX_DEPTH = 40;

const ELEMENTS = new Set([
  'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient',
  'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'symbol', 'text', 'tspan', 'pattern',
  'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feMerge', 'feMergeNode',
  'feFlood', 'feComposite', 'feDropShadow',
]);

const ATTRIBUTES = new Set([
  'id', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height',
  'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'fill-opacity',
  'fill-rule', 'clip-rule', 'opacity', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits',
  'gradientTransform', 'spreadMethod', 'clip-path', 'mask', 'maskUnits', 'maskContentUnits',
  'clipPathUnits', 'patternUnits', 'patternContentUnits', 'patternTransform', 'viewBox',
  'preserveAspectRatio', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'letter-spacing', 'dominant-baseline', 'filter', 'stdDeviation', 'in', 'in2', 'result', 'dx', 'dy',
  'mode', 'values', 'type', 'operator', 'k1', 'k2', 'k3', 'k4', 'flood-color', 'flood-opacity', 'style',
  'href', 'visibility', 'display', 'vector-effect', 'paint-order', 'filterUnits', 'primitiveUnits',
]);

const PAINT = new Set(['fill', 'stroke', 'stop-color', 'flood-color']);

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', gold: '#ffd700', silver: '#c0c0c0',
  gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080',
  pink: '#ffc0cb', navy: '#000080', teal: '#008080', maroon: '#800000',
  olive: '#808000', brown: '#a52a2a', beige: '#f5f5dc', ivory: '#fffff0',
};

const LOCAL_URL = /url\(\s*['"]?\s*#([A-Za-z0-9_.:-]+)\s*['"]?\s*\)/g;
const PAINT_VAR = /^var\(--c(\d{1,3}),\s*(#[0-9a-f]{6})\)$/;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i;
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

interface State {
  prefix: string;
  colors: string[];
  nodes: number;
}

export function sanitizeSvg(markup: string, idPrefix = ''): SanitizedSvg {
  if (!markup || !markup.trim()) throw new SvgRejected('The SVG is empty.');
  if (/<!DOCTYPE/i.test(markup)) throw new SvgRejected("That file isn't a valid SVG (DTD is prohibited).");

  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) throw new SvgRejected("That file isn't a valid SVG.");
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || !(root.namespaceURI === null || root.namespaceURI === SVG_NS))
    throw new SvgRejected("That file isn't an SVG.");

  const state: State = { prefix: idPrefix, colors: [], nodes: 0 };
  let inner = '';
  for (const child of children(root)) inner += write(child, state, 1);

  const { viewBox, width, height } = viewBoxOf(root);
  return { viewBox, innerMarkup: inner, colors: state.colors, width, height };
}

/** The document as stored on an asset. */
export const svgDocument = (s: SanitizedSvg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${s.viewBox}">${s.innerMarkup}</svg>`;

/** Child nodes as `XDocument` sees them: elements, and text that isn't only whitespace. */
function children(el: Element): Node[] {
  const out: Node[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.ELEMENT_NODE) out.push(n);
    else if ((n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE) && /[^ \t\r\n]/.test(n.nodeValue ?? '')) out.push(n);
  }
  return out;
}

function write(node: Node, state: State, depth: number): string {
  if (++state.nodes > MAX_NODES) throw new SvgRejected('That SVG is too complex.');
  if (depth > MAX_DEPTH) throw new SvgRejected('That SVG is nested too deeply.');

  if (node.nodeType !== Node.ELEMENT_NODE) {
    const parent = node.parentNode as Element | null;
    return parent && (parent.localName === 'text' || parent.localName === 'tspan') ? htmlEncode(node.nodeValue ?? '') : '';
  }
  const el = node as Element;
  if (!(el.namespaceURI === null || el.namespaceURI === SVG_NS)) return '';
  const name = el.localName;
  if (!ELEMENTS.has(name)) return '';

  let sb = '<' + name;
  const styleParts: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    if (attr.namespaceURI === XMLNS_NS || attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue;
    const attrName = attr.namespaceURI === XLINK_NS && attr.localName === 'href'
      ? 'href'
      : attr.namespaceURI === null ? attr.localName : null;
    if (attrName === null || !ATTRIBUTES.has(attrName)) continue;
    const value = trimNet(attr.value);

    if (attrName === 'style') {
      for (const raw of value.split(';')) {
        const declaration = trimNet(raw);
        if (!declaration) continue;
        const colon = declaration.indexOf(':');
        if (colon <= 0) continue;
        const prop = trimNet(declaration.slice(0, colon)).toLowerCase();
        const propValue = trimNet(declaration.slice(colon + 1));
        if (prop === 'style' || prop === 'href' || prop === 'id' || !ATTRIBUTES.has(prop)) continue;
        const cleaned = cleanValue(prop, propValue, state);
        if (cleaned === null) continue;
        styleParts.push(`${prop}:${cleaned}`);
      }
      continue;
    }

    if (attrName === 'href') {
      if (!value.startsWith('#') || !ID.test(value.slice(1))) continue;
      sb += ` href="#${htmlEncode(state.prefix + value.slice(1))}"`;
      continue;
    }

    if (attrName === 'id') {
      if (!ID.test(value)) continue;
      sb += ` id="${htmlEncode(state.prefix + value)}"`;
      continue;
    }

    const clean = cleanValue(attrName, value, state);
    if (clean === null) continue;
    // Paint moves into style so it can hold a var() — presentation attributes can't.
    if (PAINT.has(attrName) && clean.startsWith('var(')) {
      styleParts.push(`${attrName}:${clean}`);
      continue;
    }
    sb += ` ${attrName}="${htmlEncode(clean)}"`;
  }
  if (styleParts.length) sb += ` style="${htmlEncode(styleParts.join(';'))}"`;

  const kids = children(el);
  if (!kids.length) return sb + '/>';
  sb += '>';
  for (const child of kids) sb += write(child, state, depth + 1);
  return sb + `</${name}>`;
}

/** `char.IsControl`: C0, DEL and C1. */
const isControl = (c: number) => c < 0x20 || (c >= 0x7f && c < 0xa0);

function cleanValue(property: string, value: string, state: State): string | null {
  if (value.length === 0 || value.length > 20000) return null;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    const ch = value[i];
    if (ch === '<' || ch === '>' || ch === '\\' || ch === '"' || ch === '`' || (isControl(c) && ch !== '\n' && ch !== '\r' && ch !== '\t'))
      return null;
  }
  const lower = value.toLowerCase();
  if (lower.includes('javascript') || lower.includes('expression') || lower.includes('@import')
    || lower.includes('data:') || lower.includes('http') || lower.includes('//'))
    return null;

  if (lower.includes('url(')) {
    const rewritten = value.replace(LOCAL_URL, (_m, id: string) => `url(#${state.prefix}${id})`);
    const withoutLocal = rewritten.replace(LOCAL_URL, '');
    if (withoutLocal.toLowerCase().includes('url(')) return null;
    return rewritten;
  }

  if (PAINT.has(property)) return paint(value, state);
  if (lower.includes('var(')) return null;
  return value;
}

function paint(value: string, state: State): string | null {
  const v = trimNet(value);
  const lower = v.toLowerCase();
  if (lower === 'none' || lower === 'transparent' || lower === 'currentcolor' || lower === 'inherit')
    return lower === 'currentcolor' ? 'currentColor' : lower;

  const existing = PAINT_VAR.exec(lower);
  if (existing) {
    const hex = existing[2];
    const index = register(hex, state);
    return `var(--c${index}, ${hex})`;
  }

  const normalized = normalizeColor(v);
  if (normalized === null) return null;
  return `var(--c${register(normalized, state)}, ${normalized})`;
}

function register(hex: string, state: State): number {
  const index = state.colors.indexOf(hex);
  if (index >= 0) return index;
  state.colors.push(hex);
  return state.colors.length - 1;
}

/** A colour as lowercase `#rrggbb`, or null when it isn't one we recognise. */
export function normalizeColor(value: string): string | null {
  const v = trimNet(value);
  const key = v.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NAMED, key)) return NAMED[key];
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (!/^[0-9a-fA-F]*$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) return '#' + [...hex.slice(0, 3)].map((c) => c + c).join('').toLowerCase();
    if (hex.length === 6 || hex.length === 8) return '#' + hex.slice(0, 6).toLowerCase();
    return null;
  }
  const rgb = RGB.exec(v);
  if (rgb) {
    return '#' + [1, 2, 3].map((i) => Math.min(255, Math.max(0, parseInt(rgb[i], 10))).toString(16).padStart(2, '0')).join('');
  }
  return null;
}

/** `double.TryParse(…, NumberStyles.Float, InvariantCulture)`. */
function parseFloatNet(s: string): number {
  const t = s.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
  if (/^[+-]?(Infinity|∞)$/.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
  return NaN;
}

function viewBoxOf(root: Element): { viewBox: string; width: number; height: number } {
  const vb = root.getAttribute('viewBox');
  if (vb !== null) {
    const nums = vb.split(/[ ,]/).filter((p) => p.length > 0).map(parseFloatNet);
    if (nums.length === 4 && nums.every(Number.isFinite) && nums[2] > 0 && nums[3] > 0)
      return { viewBox: nums.map(num).join(' '), width: nums[2], height: nums[3] };
  }
  const w = length(root.getAttribute('width')) ?? 100;
  const h = length(root.getAttribute('height')) ?? 100;
  return { viewBox: `0 0 ${num(w)} ${num(h)}`, width: w, height: h };
}

function length(value: string | null): number | null {
  if (value === null || !value.trim()) return null;
  let digits = '';
  for (const c of trimNet(value)) {
    if (/[0-9.]/.test(c)) digits += c;
    else break;
  }
  const d = parseFloatNet(digits);
  return Number.isFinite(d) && d > 0 ? d : null;
}

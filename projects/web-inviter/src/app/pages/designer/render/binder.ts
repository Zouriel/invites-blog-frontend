/**
 * The C# `ServerBinder`, in the browser: binds sample data into a compiled page the way a guest's
 * invitation is bound — missing values blank their element, empty optionals hide, galleries clone,
 * blocks and dress colours apply — so the preview shows what a guest would see.
 */
import { htmlEncode } from './css';
import type { Json } from './sample-data';
import { TEMPLATE_RUNTIME } from './scripts';

export function bind(html: string, data: Json): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  applyTheme(doc, data?.themeVars ?? null);
  applyText(doc, data);
  applyHrefs(doc, data);
  applyImages(doc, data);
  hideEmptyOptionals(doc);
  applyBlocks(doc, Array.isArray(data?.resolvedBlocks) ? data.resolvedBlocks : null);
  applyDressColors(doc, Array.isArray(data?.dressColors) ? data.dressColors : null);
  stripReducedMotion(doc);
  swapRuntime(doc, data);

  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

function applyTheme(doc: Document, vars: Record<string, Json> | null): void {
  if (!vars || typeof vars !== 'object') return;
  let declarations = doc.documentElement.getAttribute('style') ?? '';
  for (const [name, node] of Object.entries(vars)) {
    if (!name.startsWith('--') || node == null) continue;
    const value = stringify(node);
    if (value.includes(';') || value.includes('}')) continue;
    if (declarations.length > 0 && !declarations.endsWith(';')) declarations += ';';
    declarations += `${name}:${value};`;
  }
  if (declarations.length > 0) doc.documentElement.setAttribute('style', declarations);
}

function applyText(doc: Document, data: Json): void {
  for (const el of Array.from(doc.querySelectorAll('[data-var]'))) {
    const value = resolve(data, el.getAttribute('data-var'));
    el.textContent = value == null ? '' : stringify(value);
  }
}

function applyHrefs(doc: Document, data: Json): void {
  for (const el of Array.from(doc.querySelectorAll('[data-href]'))) {
    const value = resolve(data, el.getAttribute('data-href'));
    const resolved = value == null ? null : stringify(value);
    if (resolved) {
      el.setAttribute('href', resolved);
      continue;
    }
    const authored = el.getAttribute('href');
    if (!authored || authored === '#') hide(el);
  }
}

function applyImages(doc: Document, data: Json): void {
  let groups = 0;
  for (const el of Array.from(doc.querySelectorAll('[data-src]'))) {
    const value = resolve(data, el.getAttribute('data-src'));
    if (value == null) continue;
    if (!Array.isArray(value)) {
      el.setAttribute('src', stringify(value));
      continue;
    }
    if (value.length === 0) continue;
    const groupId = 'g' + ++groups;
    el.setAttribute('data-gallery-of', groupId);
    el.setAttribute('src', stringify(value[0]));
    let anchor: Element = el;
    for (let i = 1; i < value.length; i++) {
      const photo = value[i];
      if (photo == null) continue;
      const clone = el.cloneNode(true) as Element;
      clone.removeAttribute('data-gallery-of');
      clone.setAttribute('data-gallery-clone', groupId);
      clone.setAttribute('src', stringify(photo));
      anchor.after(clone);
      anchor = clone;
    }
  }
}

function hideEmptyOptionals(doc: Document): void {
  for (const el of Array.from(doc.querySelectorAll('[data-optional]'))) {
    const filled = isFilled(el) || Array.from(el.querySelectorAll('[data-var], [data-href], [data-src]')).some(isFilled);
    if (!filled) hide(el);
  }
}

function isFilled(el: Element): boolean {
  if (el.hasAttribute('data-var') && (el.textContent ?? '').trim().length > 0) return true;
  if (el.hasAttribute('data-href')) {
    const href = el.getAttribute('href');
    if (href && href !== '#' && !href.toLowerCase().startsWith('javascript:')) return true;
  }
  if (el.hasAttribute('data-src') && el.getAttribute('src')) return true;
  return false;
}

function applyBlocks(doc: Document, resolved: Json[] | null): void {
  if (resolved === null) return;
  const keep = new Set(resolved.map((b) => (b == null ? '' : stringify(b))).filter((b) => b));
  for (const el of Array.from(doc.querySelectorAll('[data-block]')))
    if (!keep.has(el.getAttribute('data-block') ?? '')) hide(el);
}

function stripReducedMotion(doc: Document): void {
  for (const style of Array.from(doc.querySelectorAll('style'))) {
    const css = style.textContent ?? '';
    if (css.toLowerCase().includes('prefers-reduced-motion')) style.textContent = removeReducedMotionBlocks(css);
  }
}

export function removeReducedMotionBlocks(css: string): string {
  let result = '';
  let i = 0;
  const lower = css.toLowerCase();
  while (i < css.length) {
    const at = lower.indexOf('@media', i);
    if (at < 0) { result += css.slice(i); break; }
    const open = css.indexOf('{', at);
    if (open < 0) { result += css.slice(i); break; }
    const prelude = lower.slice(at, open);
    if (!prelude.includes('prefers-reduced-motion') || !prelude.includes('reduce')) {
      result += css.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    const close = matchingBrace(css, open);
    if (close < 0) { result += css.slice(i); break; }
    result += css.slice(i, at);
    i = close + 1;
  }
  return result;
}

function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function swapRuntime(doc: Document, data: Json): void {
  let payload = doc.getElementById('invite-data');
  if (!payload) {
    payload = doc.createElement('script');
    payload.id = 'invite-data';
    payload.setAttribute('type', 'application/json');
    (doc.body ?? doc.documentElement).appendChild(payload);
  }
  payload.textContent = JSON.stringify(data);
  payload.setAttribute('data-bound', '1');

  for (const script of Array.from(doc.querySelectorAll('script')))
    if ((script.textContent ?? '').includes('__inviteReady')) script.remove();

  const runtime = doc.createElement('script');
  runtime.textContent = TEMPLATE_RUNTIME;
  (doc.body ?? doc.documentElement).appendChild(runtime);
}

function applyDressColors(doc: Document, palettes: Json[] | null): void {
  for (const el of Array.from(doc.querySelectorAll('[data-dress-colors]'))) {
    if (!palettes || palettes.length === 0) {
      hide(el);
      continue;
    }
    el.innerHTML = dressColorsHtml(palettes);
  }
}

function dressColorsHtml(palettes: Json[]): string {
  let sb = '';
  const showRole = palettes.length > 1;
  for (const entry of palettes) {
    const role = entry?.role == null ? '' : stringify(entry.role);
    const colors = Array.isArray(entry?.colors) ? (entry.colors as Json[]).filter((c) => c != null).map(stringify) : [];
    if (colors.length === 0) continue;
    sb += '<div class="ib-dress">';
    if (showRole) sb += `<p class="ib-dress__role">${htmlEncode(role)}</p>`;
    sb += '<div class="ib-dress__swatches">';
    for (const c of colors) sb += `<span class="ib-dress__swatch" title="${c}" style="background:${c}"></span>`;
    sb += '</div></div>';
  }
  return sb;
}

function hide(el: Element): void {
  const style = el.getAttribute('style');
  el.setAttribute('style', !style ? 'display:none' : style.trimEnd().replace(/;+$/, '') + ';display:none');
}

/** Walks a dot-path; missing and null both read as missing. A number steps into a list. */
function resolve(root: Json, path: string | null): Json {
  if (!path) return null;
  let node: Json = root;
  for (const segment of path.split('.')) {
    if (Array.isArray(node)) {
      if (!/^\d+$/.test(segment)) return null;
      const i = Number(segment);
      if (i >= node.length || node[i] == null) return null;
      node = node[i];
      continue;
    }
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, segment) || node[segment] == null) return null;
    node = node[segment];
  }
  return node;
}

/** A JSON string renders as its text; anything else as its JSON. */
function stringify(node: Json): string {
  return typeof node === 'string' ? node : JSON.stringify(node);
}

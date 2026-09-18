/**
 * The C# `DesignCompiler`, in the browser: a scene in, the same single-file template out, byte for
 * byte. The editor previews with this so an edit shows at once instead of after a trip to the server;
 * the server still compiles everything that is published, and parity tests hold the two together.
 *
 * <p>Keep it a transcription. When the C# changes, change this the same way, in the same order —
 * `parity.spec.ts` compares the two outputs on a corpus of scenes and fails on the first byte that
 * differs.</p>
 */
import {
  CANVAS_W, ELEMENT_TYPES, LIMITS, REFERENCE_VIEWPORT, blank, clamp, clampInt, color, easing as easingOf, findFont, findVariable,
  font as fontOf, htmlEncode, isHex, isThemeKey, num, slug, trim, truncate, u, type RenderCatalog,
} from './css';
import { isFontKey, normalizeScene, walk, type NContour, type NElement, type NField, type NScene, type NTypography } from './model';
import { DETECT_SCRIPT, EDITOR_SCRIPT, FALLBACK_SCRIPT } from './scripts';
import { SvgRejected, sanitizeSvg } from './svg-sanitizer';

export interface CompileOptions {
  /** Where published fonts are served from, ending in a slash. */
  fontBaseUrl?: string;
  title?: string;
  /** Adds the editor bridge (scroll sync). */
  editorPreview?: boolean;
  initialScroll?: number;
  hiddenElementIds?: ReadonlySet<string>;
}

type Font = RenderCatalog['fonts'][number];

interface Context {
  scene: NScene;
  catalog: RenderCatalog;
  options: Required<Omit<CompileOptions, 'hiddenElementIds'>> & { hiddenElementIds: ReadonlySet<string> | null };
  themeKeys: Set<string>;
  fields: Map<string, NField>;
  offeredFonts: Font[];
  loadedFonts: Font[];
  svgSymbols: Map<string, number>;
  imageClasses: Map<string, number>;
  svgColors: Map<string, string[]>;
  emittedImages: Set<string>;
  next: number;
}

/** Compiles a scene (the editor's own objects are fine: C# defaults are applied first). */
export function compileDesign(rawScene: unknown, catalog: RenderCatalog, options: CompileOptions = {}): string {
  return compile(normalizeScene(rawScene), catalog, options);
}

export function compile(scene: NScene, catalog: RenderCatalog, opts: CompileOptions = {}): string {
  const ctx = context(scene, catalog, opts);
  let body = '';
  let css = '';

  css += rootCss(ctx);
  body += symbols(ctx);

  body += '<main class="ib-page">';
  for (const element of scene.elements) {
    const out = emitElement(ctx, element);
    body += out.body;
    css += out.css;
  }
  body += '</main><div class="ib-tail"></div>';

  let html = '<!doctype html>\n<html lang="en">\n<head>\n';
  html += '<meta charset="utf-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
  html += '<meta name="generator" content="invites.blog designer">\n';
  const roles = distinct(scene.roles.filter((r) => !blank(r)).map(trim));
  if (roles.length) html += `<meta name="ib-roles" content="${htmlEncode(roles.join(', '))}">\n`;
  if (ctx.offeredFonts.length)
    html += `<meta name="ib-fonts" content="${htmlEncode(ctx.offeredFonts.map((f) => f.name).join(', '))}">\n`;
  html += `<title>${htmlEncode(ctx.options.title)}</title>\n`;
  html += `<style>${css}</style>\n`;
  html += `<script>${DETECT_SCRIPT}</script>\n`;
  html += '</head>\n<body>';
  html += body;
  html += `\n<script>${FALLBACK_SCRIPT}</script>`;
  if (ctx.options.editorPreview)
    html += `\n<script>${EDITOR_SCRIPT.replaceAll('__SCROLL__', num(Math.max(0, ctx.options.initialScroll)))}</script>`;
  html += '\n</body>\n</html>\n';
  return html;
}

function distinct<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function context(scene: NScene, catalog: RenderCatalog, opts: CompileOptions): Context {
  const themeKeys = new Set(scene.theme.filter((t) => isThemeKey(t.key)).map((t) => t.key));
  const fields = new Map<string, NField>();
  for (const f of scene.fields) if (!blank(f.path) && !fields.has(f.path)) fields.set(f.path, f);

  const ids: string[] = [];
  for (const id of scene.fonts) if (findFont(catalog, id)) ids.push(id);
  for (const t of scene.theme) if (isFontKey(t.key) && findFont(catalog, t.value)) ids.push(t.value);
  const offeredFonts = distinct(scene.fonts.map((id) => findFont(catalog, id)).filter((f): f is Font => !!f));
  for (const t of scene.theme) {
    const f = isFontKey(t.key) ? findFont(catalog, t.value) : undefined;
    if (f && !offeredFonts.includes(f)) offeredFonts.push(f);
  }
  for (const { el } of walk(scene.elements)) {
    const f = el.text?.style.font ?? el.button?.style.font ?? el.dress?.style.font ?? null;
    if (f !== null && !f.startsWith('theme:') && findFont(catalog, f)) ids.push(f);
  }
  const loadedFonts = distinct(ids).map((id) => findFont(catalog, id)!);

  const svgSymbols = new Map<string, number>();
  for (const { el } of walk(scene.elements)) {
    if (el.type !== 'svg' || !el.svg) continue;
    const asset = own(scene.assets, el.svg.asset);
    if (!asset || asset.kind !== 'svg') continue;
    if (!svgSymbols.has(el.svg.asset)) svgSymbols.set(el.svg.asset, svgSymbols.size);
  }
  const imageClasses = new Map<string, number>();
  for (const { el } of walk(scene.elements)) {
    if (el.type !== 'image' || !el.image) continue;
    const asset = own(scene.assets, el.image.asset);
    if (!asset || asset.kind !== 'image') continue;
    if (!imageClasses.has(el.image.asset)) imageClasses.set(el.image.asset, imageClasses.size);
  }

  return {
    scene, catalog, themeKeys, fields, offeredFonts, loadedFonts, svgSymbols, imageClasses,
    svgColors: new Map(), emittedImages: new Set(), next: 0,
    options: {
      fontBaseUrl: opts.fontBaseUrl ?? '/assets/fonts/', title: opts.title ?? 'Invitation', editorPreview: !!opts.editorPreview,
      initialScroll: opts.initialScroll ?? 0, hiddenElementIds: opts.hiddenElementIds ?? null,
    },
  };
}

const own = <T>(record: Record<string, T>, key: string | null | undefined): T | undefined =>
  key != null && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

// ----- Page length (DesignScene.ScrollRange / PageHeight) -----

export function scrollRange(scene: NScene): number {
  let bottom = 0;
  for (const el of scene.elements) {
    if (!Number.isFinite(el.y) || !Number.isFinite(el.h)) continue;
    let end = el.y + Math.max(0, el.h);
    const t = el.track;
    if (el.pinned && t && Number.isFinite(t.start) && Number.isFinite(t.end) && t.end > t.start) end += t.end - Math.max(0, t.start);
    bottom = Math.max(bottom, end);
  }
  // On to where the last motion track ends, so an exit plays before the page stops.
  let motion = 0;
  for (const { el } of walk(scene.elements)) {
    const t = el.track;
    if (t && Number.isFinite(t.start) && Number.isFinite(t.end) && t.end > t.start) motion = Math.max(motion, t.end);
  }
  return Math.min(LIMITS.maxPageHeight, Math.max(0, bottom - REFERENCE_VIEWPORT, motion));
}

export const pageHeight = (scene: NScene) => scrollRange(scene) + REFERENCE_VIEWPORT;

// ----- Stylesheet head -----

function rootCss(ctx: Context): string {
  let css = ':root{';
  for (const entry of ctx.scene.theme) {
    if (!isThemeKey(entry.key)) continue;
    const value = isFontKey(entry.key)
      ? findFont(ctx.catalog, entry.value)?.stack ?? null
      : isHex(entry.value) ? entry.value.toLowerCase() : null;
    if (value === null) continue;
    css += `--ib-${entry.key}:${value};`;
  }
  css += '}';
  css += `:root{--u:calc(min(100vw, 480px) / ${num(CANVAS_W)})}`;
  for (const f of ctx.loadedFonts)
    for (const weight of f.weights)
      css += `@font-face{font-family:"${f.name}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${htmlEncode(ctx.options.fontBaseUrl)}${f.id}-${weight}.woff2") format("woff2")}`;

  const bg = ctx.themeKeys.has('bg') ? 'var(--ib-bg)' : '#ffffff';
  const text = ctx.themeKeys.has('text') ? 'var(--ib-text)' : '#111111';
  css += `html{background:${bg};overflow-x:hidden}`;
  css += `body{margin:0;color:${text};-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-font-smoothing:antialiased}`;
  css += `.ib-page{position:relative;display:block;margin:0 auto;overflow:hidden;width:${u(CANVAS_W)};height:${u(pageHeight(ctx.scene))}}`;
  if (ctx.options.editorPreview) css += `.ib-page{margin-bottom:${u(REFERENCE_VIEWPORT)}}`;
  css += `.ib-tail{height:max(0px, calc(100lvh - ${num(REFERENCE_VIEWPORT)} * var(--u)))}`;
  css += '.ib-sec{position:absolute;left:0;width:100%}';
  css += '.e{position:absolute;margin:0}';
  css += '.a{position:relative;width:100%;height:100%;transform-origin:50% 50%}';
  css += '.t{margin:0;white-space:pre-wrap;overflow-wrap:break-word}';
  css += '.b{display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-decoration:none;box-sizing:border-box;text-align:center}';
  css += '.s{display:block;width:100%;height:100%;overflow:visible}';
  css += '.ib-fb .e,.ib-fb .a{animation-play-state:paused!important}';
  if (ctx.options.editorPreview) css += 'html{scrollbar-width:none}html::-webkit-scrollbar{display:none}';
  return css;
}

function symbols(ctx: Context): string {
  if (!ctx.svgSymbols.size) return '';
  let body = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">';
  for (const [assetId, index] of [...ctx.svgSymbols].sort((a, b) => a[1] - b[1])) {
    const asset = own(ctx.scene.assets, assetId)!;
    let clean;
    try { clean = sanitizeSvg(asset.data, `s${index}-`); } catch (e) { if (e instanceof SvgRejected) continue; throw e; }
    ctx.svgColors.set(assetId, clean.colors);
    body += `<symbol id="s${index}" viewBox="${clean.viewBox}">${clean.innerMarkup}</symbol>`;
  }
  return body + '</svg>';
}

// ----- Elements -----

function emitElement(ctx: Context, el: NElement): { body: string; css: string } {
  if (ctx.options.hiddenElementIds?.has(el.id)) return { body: '', css: '' };
  if (!ELEMENT_TYPES.includes(el.type)) return { body: '', css: '' };

  const n = ctx.next++;
  const cls = `.e${n}`;
  let inner = '';
  let css = '';
  let boundAnything = false;

  switch (el.type) {
    case 'text': { const r = emitText(ctx, el, cls); inner = r.inner; css += r.css; boundAnything = r.bound; break; }
    case 'shape': inner = emitShape(ctx, el); break;
    case 'svg': { const r = emitSvg(ctx, el, cls); inner = r.inner; css += r.css; break; }
    case 'image': { const r = emitImage(ctx, el, cls); inner = r.inner; css += r.css; break; }
    case 'slot': { const r = emitSlot(ctx, el, cls); inner = r.inner; css += r.css; boundAnything = true; break; }
    case 'rsvp':
    case 'link': { const r = emitButton(ctx, el, cls); inner = r.inner; css += r.css; boundAnything = r.bound; break; }
    case 'dress': { const r = emitDress(ctx, el, cls); inner = r.inner; css += r.css; break; }
    case 'group':
      for (const child of el.children ?? []) {
        const r = emitElement(ctx, child);
        inner += r.body;
        css += r.css;
      }
      break;
  }

  const track = trackOf(ctx.scene, el);
  const animated = el.keyframes.length > 0;

  let body = `<div class="e e${n}"`;
  if (animated || el.pinned) body += ` data-ts="${num(track.start)}" data-te="${num(track.end)}"`;
  if (!blank(el.block)) {
    const block = slug(el.block!);
    if (block.length > 0) body += ` data-block="${block}"`;
  }
  if (boundAnything) body += ' data-optional';
  body += `><div class="a">${inner}</div></div>`;

  const frames = animated && track.end > track.start ? resolveFrames(ctx, el) : [];
  const lifts = frames.some((f) => f.lift > 0);
  css += `${cls}{left:${u(el.x)};top:${u(el.y)};width:${u(Math.max(1, el.w))};height:${u(Math.max(1, el.h))};`;
  const boxAnimations: string[] = [];
  if (el.pinned && track.end > track.start) boxAnimations.push(`p${n}`);
  if (lifts) boxAnimations.push(`z${n}`);
  if (boxAnimations.length) {
    const range = u(track.start) + ' ' + u(track.end);
    css += `animation:${boxAnimations.map((a) => a + ' 1s linear both').join(',')};animation-timeline:${boxAnimations.map(() => 'scroll(root)').join(',')};animation-range:${boxAnimations.map(() => range).join(',')};`;
  }
  css += '}';
  if (lifts) {
    css += `@keyframes z${n}{`;
    for (const f of frames) css += `${num(f.t * 100)}%{z-index:${f.lift}}`;
    css += '}';
  }
  if (el.pinned && track.end > track.start)
    css += `@keyframes p${n}{from{transform:translateY(0px)}to{transform:translateY(${u(track.end - track.start)})}}`;

  let rest = '';
  const baseTransform = transform(0, 0, el.rotate, el.scale);
  if (baseTransform !== 'none') rest += `transform:${baseTransform};`;
  const opacity = clamp(el.opacity, 0, 1);
  if (opacity < 1) rest += `opacity:${num(opacity)};`;

  if (animated && track.end > track.start) {
    rest += `animation:k${n} 1s linear both;animation-timeline:scroll(root);animation-range:${u(track.start)} ${u(track.end)};`;
    css += `@keyframes k${n}{`;
    for (const f of resolveFrames(ctx, el)) {
      css += `${num(f.t * 100)}%{transform:${transform(f.x - el.x, f.y - el.y, f.rotate, f.scale)};opacity:${num(f.opacity)};`;
      if (f.easing !== null && f.easing !== 'linear') css += `animation-timing-function:${f.easing};`;
      css += '}';
    }
    css += '}';
  }
  if (rest.length) css += `${cls}>.a{${rest}}`;
  return { body, css };
}

function emitText(ctx: Context, el: NElement, cls: string): { inner: string; css: string; bound: boolean } {
  const text = el.text ?? { runs: [], style: defaultTypography() };
  let bound = false;
  let inner = '<p class="t">';
  for (const run of text.runs) {
    let open = '';
    let close = '';
    if (run.bold) { open += '<b>'; close = '</b>' + close; }
    if (run.italic) { open += '<i>'; close = '</i>' + close; }

    if (!blank(run.var)) {
      const span = variableSpan(ctx, el, run.var!);
      if (span === null) continue;
      inner += open + span + close;
      bound = true;
    } else if (run.text != null && run.text !== '') {
      inner += open + htmlEncode(truncate(run.text)) + close;
    }
  }
  inner += '</p>';

  const v = text.style.valign === 'top' ? 'flex-start' : text.style.valign === 'bottom' ? 'flex-end' : 'center';
  const css = `${cls}>.a{display:flex;flex-direction:column;justify-content:${v}}` + `${cls} .t{${typographyCss(ctx, text.style)}}`;
  return { inner, css, bound };
}

function defaultTypography(): NTypography {
  return { font: null, size: 18, weight: 400, italic: false, color: null, align: 'center', valign: 'middle', lineHeight: 1.3, letterSpacing: 0, uppercase: false };
}

function variableSpan(ctx: Context, el: NElement, rawPath: string): string | null {
  const path = trim(rawPath);
  const catalog = findVariable(ctx.catalog, path);
  const custom = ctx.fields.get(path);
  if (!catalog && !custom) return null;
  if (catalog && catalog.kind === 'image') return null;

  let sb = `<span data-var="${htmlEncode(path)}"`;
  if (custom) {
    sb += ` data-field-label="${htmlEncode(custom.label)}"`;
    if (ctx.catalog.fieldTypes.includes(custom.type) && custom.type !== 'text') sb += ` data-type="${custom.type}"`;
    if (custom.type === 'select' && custom.options && custom.options.length > 0)
      sb += ` data-options="${htmlEncode(custom.options.map((o) => o.replaceAll(',', ' ')).join(','))}"`;
  } else if (catalog && path.startsWith('event.') && !path.startsWith('event.venue.')) {
    sb += ` data-field-label="${htmlEncode(catalog.label)}"`;
    if (catalog.type === 'textarea' || catalog.type === 'date' || catalog.type === 'time') sb += ` data-type="${catalog.type}"`;
  }
  const scope = roleScope(ctx, custom?.roleScope ?? el.roleScope);
  if (scope !== null) sb += ` data-role-scope="${htmlEncode(scope)}"`;

  const sample = custom?.sample ?? catalog?.sample ?? custom?.label ?? '';
  sb += `>${htmlEncode(truncate(sample))}</span>`;
  return sb;
}

function emitShape(ctx: Context, el: NElement): string {
  const shape = el.shape ?? { kind: 'rect', path: null, sides: 6, fill: null, stroke: null, strokeWidth: 0, radius: 0 };
  const w = Math.max(1, el.w);
  const h = Math.max(1, el.h);
  const fill = color(shape.fill, ctx.themeKeys) ?? 'transparent';
  const stroke = color(shape.stroke, ctx.themeKeys);
  const sw = stroke === null ? 0 : clamp(shape.strokeWidth, 0, Math.min(w, h) / 2);
  let style = `fill:${fill}`;
  if (sw > 0) style += `;stroke:${stroke};stroke-width:${num(sw)}`;
  const half = sw / 2;

  let inner = `<svg class="s" viewBox="0 0 ${num(w)} ${num(h)}" preserveAspectRatio="none" aria-hidden="true">`;
  if (shape.kind === 'path' && shape.path) {
    return inner + emitPath(shape.path, fill, stroke, sw, color(shape.fill, ctx.themeKeys));
  }
  switch (shape.kind) {
    case 'ellipse':
      inner += `<ellipse cx="${num(w / 2)}" cy="${num(h / 2)}" rx="${num(Math.max(0, w / 2 - half))}" ry="${num(Math.max(0, h / 2 - half))}" style="${style}"/>`;
      break;
    case 'line': {
      const lineStroke = color(shape.stroke, ctx.themeKeys) ?? color(shape.fill, ctx.themeKeys) ?? 'currentColor';
      const lw = clamp(shape.strokeWidth <= 0 ? 2 : shape.strokeWidth, 0.5, h);
      inner += `<line x1="0" y1="${num(h / 2)}" x2="${num(w)}" y2="${num(h / 2)}" style="stroke:${lineStroke};stroke-width:${num(lw)}"/>`;
      break;
    }
    case 'polygon': {
      const sides = clampInt(shape.sides, 3, 12);
      const points: string[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = -Math.PI / 2 + i * 2 * Math.PI / sides;
        points.push(`${num(w / 2 + (w / 2 - half) * Math.cos(angle))},${num(h / 2 + (h / 2 - half) * Math.sin(angle))}`);
      }
      inner += `<polygon points="${points.join(' ')}" style="${style}"/>`;
      break;
    }
    default: {
      const r = clamp(shape.radius, 0, Math.min(w, h) / 2);
      inner += `<rect x="${num(half)}" y="${num(half)}" width="${num(Math.max(0, w - sw))}" height="${num(Math.max(0, h - sw))}"`;
      if (r > 0) inner += ` rx="${num(r)}"`;
      inner += ` style="${style}"/>`;
    }
  }
  return inner + '</svg>';
}

function emitPath(path: { width: number; height: number; contours: NContour[] }, fill: string, stroke: string | null, strokeWidth: number, fillColor: string | null): string {
  const pw = clamp(path.width, 1, 10000);
  const ph = clamp(path.height, 1, 10000);
  let out = `<svg viewBox="0 0 ${num(pw)} ${num(ph)}" preserveAspectRatio="none" width="100%" height="100%" overflow="visible">`;
  const closed = pathD(path.contours.filter((c) => c.closed));
  const open = pathD(path.contours.filter((c) => !c.closed));
  if (closed.length > 0) {
    out += `<path d="${closed}" fill-rule="nonzero" style="fill:${fill}`;
    if (strokeWidth > 0 && stroke !== null) out += `;stroke:${stroke};stroke-width:${num(strokeWidth)};stroke-linejoin:round`;
    out += '"/>';
  }
  if (open.length > 0) {
    const lineColor = stroke ?? fillColor ?? 'currentColor';
    const lineWidth = strokeWidth > 0 ? strokeWidth : 2;
    out += `<path d="${open}" style="fill:none;stroke:${lineColor};stroke-width:${num(lineWidth)};stroke-linecap:round;stroke-linejoin:round"/>`;
  }
  return out + '</svg></svg>';
}

/** SVG path data for contours. Only numbers are written. */
export function pathD(contours: NContour[]): string {
  const finite = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y);
  let d = '';
  for (const c of contours.slice(0, LIMITS.maxPathContours)) {
    const pts = c.points.filter((p) => finite(p.x, p.y) && (p.in === null || finite(p.in.x, p.in.y)) && (p.out === null || finite(p.out.x, p.out.y)))
      .slice(0, LIMITS.maxPathPoints);
    if (pts.length < 2) continue;
    d += `M${num(pts[0].x)} ${num(pts[0].y)}`;
    const count = c.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a.out === null && b.in === null) {
        d += `L${num(b.x)} ${num(b.y)}`;
      } else {
        const c1x = a.out?.x ?? a.x, c1y = a.out?.y ?? a.y;
        const c2x = b.in?.x ?? b.x, c2y = b.in?.y ?? b.y;
        d += `C${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(b.x)} ${num(b.y)}`;
      }
    }
    if (c.closed) d += 'Z';
  }
  return d;
}

function emitSvg(ctx: Context, el: NElement, cls: string): { inner: string; css: string } {
  const index = el.svg ? ctx.svgSymbols.get(el.svg.asset) : undefined;
  if (!el.svg || index === undefined) return { inner: '', css: '' };
  const colors = ctx.svgColors.get(el.svg.asset);
  if (!colors) return { inner: '', css: '' };
  const inner = `<svg class="s" aria-hidden="true"><use href="#s${index}" width="100%" height="100%"/></svg>`;
  let vars = '';
  colors.forEach((c, i) => {
    const reference = own(el.svg!.fills, c);
    if (reference === undefined) return;
    const value = color(reference, ctx.themeKeys);
    if (value !== null) vars += `--c${i}:${value};`;
  });
  return { inner, css: vars.length ? `${cls}{${vars}}` : '' };
}

function emitImage(ctx: Context, el: NElement, cls: string): { inner: string; css: string } {
  const index = el.image ? ctx.imageClasses.get(el.image.asset) : undefined;
  if (!el.image || index === undefined) return { inner: '', css: '' };
  const asset = own(ctx.scene.assets, el.image.asset)!;
  const uri = imageDataUri(asset.data);
  if (uri === null) return { inner: '', css: '' };

  const imageClass = `i${index}`;
  let css = '';
  if (!ctx.emittedImages.has(imageClass)) {
    ctx.emittedImages.add(imageClass);
    css += `.${imageClass}{background-image:url("${uri}")}`;
  }
  const inner = `<div class="${imageClass}" role="presentation"></div>`;
  css += `${cls} .${imageClass}{width:100%;height:100%;background-repeat:no-repeat;background-position:center;background-size:${el.image.fit === 'contain' ? 'contain' : 'cover'}`;
  if (el.image.radius > 0) css += `;border-radius:${u(el.image.radius)}`;
  css += '}';
  return { inner, css };
}

function emitSlot(ctx: Context, el: NElement, cls: string): { inner: string; css: string } {
  const slot = el.slot ?? { path: 'event.coverImage', label: 'Photo', fit: 'cover', radius: 0, multiple: false, min: null, max: null, columns: 2, gap: 8, aspect: 1, index: null };
  let path = slotPath(ctx, slot.path);
  const index = slot.index ?? (!slot.multiple && path === 'event.gallery' ? 1 : null);
  if (!slot.multiple && index !== null && index >= 1 && index <= LIMITS.maxGalleryIndex) path += '.' + (index - 1);
  let inner = `<img data-src="${htmlEncode(path)}" data-slot-label="${htmlEncode(blank(slot.label) ? 'Photo' : truncate(trim(slot.label!), 60))}"`;
  if (slot.multiple) {
    inner += ' data-multiple="true"';
    if (slot.min !== null && slot.min > 0) inner += ` data-min-images="${slot.min}"`;
    if (slot.max !== null && slot.max > 0) inner += ` data-max-images="${slot.max}"`;
  }
  const scope = roleScope(ctx, el.roleScope);
  if (scope !== null) inner += ` data-role-scope="${htmlEncode(scope)}"`;
  inner += ' alt="">';

  const fit = slot.fit === 'contain' ? 'contain' : 'cover';
  const radius = slot.radius > 0 ? `;border-radius:${u(slot.radius)}` : '';
  let css = '';
  if (slot.multiple) {
    const cols = clampInt(slot.columns, 1, 6);
    css += `${cls}>.a{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${u(clamp(slot.gap, 0, 80))};align-content:start;overflow:hidden}`;
    css += `${cls} img{display:block;width:100%;aspect-ratio:${num(clamp(slot.aspect, 0.2, 5))};object-fit:${fit}${radius}}`;
  } else {
    css += `${cls} img{display:block;width:100%;height:100%;object-fit:${fit}${radius}}`;
  }
  return { inner, css };
}

function emitButton(ctx: Context, el: NElement, cls: string): { inner: string; css: string; bound: boolean } {
  const button = el.button ?? { path: null, label: 'Open', fill: null, stroke: null, strokeWidth: 0, radius: 999, style: defaultTypography() };
  let path: string;
  if (el.type === 'rsvp') {
    path = 'rsvp.link';
  } else {
    path = button.path != null ? trim(button.path) : '';
    const field = ctx.fields.get(path);
    const allowed = ctx.catalog.linkPaths.includes(path) || (!!field && field.type === 'url');
    if (!allowed) return { inner: '', css: '', bound: false };
  }

  let inner = `<a class="b" data-href="${htmlEncode(path)}" href="#"`;
  if (path === 'event.venue.mapLink' || ctx.fields.has(path)) inner += ' target="_blank" rel="noopener"';
  const custom = ctx.fields.get(path);
  const scope = custom ? roleScope(ctx, custom.roleScope ?? el.roleScope) : null;
  if (scope !== null) inner += ` data-role-scope="${htmlEncode(scope)}"`;
  inner += '>';
  if (el.type === 'rsvp') inner += '<span data-var="rsvp.label">Reply now</span>';
  else inner += htmlEncode(truncate(blank(button.label) ? 'Open' : button.label!, 80));
  inner += '</a>';

  let css = `${cls} .b{${typographyCss(ctx, button.style)}`;
  const fill = color(button.fill, ctx.themeKeys);
  if (fill !== null) css += `background:${fill};`;
  const stroke = color(button.stroke, ctx.themeKeys);
  if (stroke !== null && button.strokeWidth > 0) css += `border:${u(clamp(button.strokeWidth, 0, 20))} solid ${stroke};`;
  css += `border-radius:${u(clamp(button.radius, 0, 999))};padding:0 ${u(12)}}`;
  return { inner, css, bound: true };
}

function emitDress(ctx: Context, el: NElement, cls: string): { inner: string; css: string } {
  const dress = el.dress ?? { swatch: 40, shape: 'circle', gap: 10, style: defaultTypography() };
  const inner = '<div class="d" data-dress-colors></div>';
  const size = u(clamp(dress.swatch, 8, 160));
  const justify = dress.style.align === 'left' ? 'flex-start' : dress.style.align === 'right' ? 'flex-end' : 'center';
  let css = `${cls} .d{width:100%;height:100%;overflow:hidden}`;
  css += `${cls} .ib-dress{margin:0 0 ${u(12)}}`;
  css += `${cls} .ib-dress__role{margin:0 0 ${u(8)};${typographyCss(ctx, dress.style)}}`;
  css += `${cls} .ib-dress__swatches{display:flex;flex-wrap:wrap;gap:${u(clamp(dress.gap, 0, 60))};justify-content:${justify}}`;
  css += `${cls} .ib-dress__swatch{display:block;width:${size};height:${size};border-radius:${dress.shape === 'square' ? u(6) : '50%'};box-shadow:0 0 0 1px color-mix(in srgb, currentColor 25%, transparent)}`;
  return { inner, css };
}

// ----- Helpers -----

function typographyCss(ctx: Context, style: NTypography): string {
  let sb = '';
  const f = fontOf(style.font, ctx.themeKeys, ctx.catalog);
  if (f !== null) sb += `font-family:${f};`;
  sb += `font-size:${u(clamp(style.size, 4, 400))};`;
  sb += `font-weight:${clampInt(Math.trunc(style.weight / 100) * 100, 100, 900)};`;
  if (style.italic) sb += 'font-style:italic;';
  const c = color(style.color, ctx.themeKeys);
  if (c !== null) sb += `color:${c};`;
  sb += `text-align:${style.align === 'left' || style.align === 'right' ? style.align : 'center'};`;
  sb += `line-height:${num(clamp(style.lineHeight, 0.6, 4))};`;
  if (style.letterSpacing !== 0) sb += `letter-spacing:${num(clamp(style.letterSpacing, -0.2, 2))}em;`;
  if (style.uppercase) sb += 'text-transform:uppercase;';
  return sb;
}

function transform(dx: number, dy: number, rotate: number, scale: number): string {
  const parts: string[] = [];
  if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) parts.push(`translate(${u(dx)},${u(dy)})`);
  if (Math.abs(rotate) > 0.0005) parts.push(`rotate(${num(clamp(rotate, -3600, 3600))}deg)`);
  if (Math.abs(scale - 1) > 0.0005) parts.push(`scale(${num(clamp(scale, 0, 20))})`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}

export interface ResolvedFrame { t: number; x: number; y: number; rotate: number; scale: number; opacity: number; easing: string | null; lift: number }

/** Keyframes with every property filled in, held at 0% and 100% — `DesignCompiler.ResolveFrames`. */
export function resolveFrames(ctx: { catalog: RenderCatalog }, el: NElement): ResolvedFrame[] {
  const frames = el.keyframes
    .filter((k) => !Number.isNaN(k.t))
    .map((k, i) => ({ k, i, key: clamp(k.t, 0, 1) }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .slice(0, LIMITS.maxKeyframes)
    .map((x) => x.k);
  const result: ResolvedFrame[] = [];
  let x = el.x, y = el.y, rotate = el.rotate, scale = el.scale, opacity = clamp(el.opacity, 0, 1);
  let lift = 0;
  for (const k of frames) {
    lift = clampInt(k.lift ?? lift, 0, LIMITS.maxLift);
    x = k.x ?? x;
    y = k.y ?? y;
    rotate = k.rotate ?? rotate;
    scale = k.scale ?? scale;
    opacity = clamp(k.opacity ?? opacity, 0, 1);
    const t = clamp(k.t, 0, 1);
    if (result.length > 0 && Math.abs(result[result.length - 1].t - t) < 0.00001) result.pop();
    result.push({ t, x, y, rotate, scale, opacity, easing: easingOf(k.easing, ctx.catalog), lift });
  }
  if (!result.length) return result;
  if (result[0].t > 0) result.unshift({ ...result[0], t: 0, easing: null });
  if (result[result.length - 1].t < 1) result.push({ ...result[result.length - 1], t: 1, easing: null });
  return result;
}

export function trackOf(scene: NScene, el: NElement): { start: number; end: number } {
  if (el.track === null) return { start: 0, end: Math.max(1, scrollRange(scene)) };
  return { start: clamp(el.track.start, 0, LIMITS.maxPageHeight), end: clamp(el.track.end, 0, LIMITS.maxPageHeight) };
}

function roleScope(ctx: Context, scope: string | null): string | null {
  if (blank(scope)) return null;
  const s = slug(scope!);
  return ctx.scene.roles.some((r) => slug(r) === s) ? s : null;
}

function slotPath(ctx: Context, raw: string | null): string {
  const p = raw != null ? trim(raw) : '';
  if (findVariable(ctx.catalog, p)?.kind === 'image') return p;
  if (p.startsWith('event.')) {
    const key = slug(p.slice(6), true);
    if (key.length > 0) return 'event.' + key;
  }
  return 'event.coverImage';
}

/** A data: URI rebuilt from an allowed raster type and strict base64, else null. */
export function imageDataUri(data: string | null | undefined): string | null {
  if (!data) return null;
  for (const type of ['image/webp', 'image/png', 'image/jpeg', 'image/gif']) {
    const prefix = `data:${type};base64,`;
    if (!data.startsWith(prefix)) continue;
    const payload = data.slice(prefix.length);
    if (!/^[A-Za-z0-9+/=]*$/.test(payload)) return null;
    return prefix + payload;
  }
  return null;
}

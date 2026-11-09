import { CANVAS_WIDTH, type CatalogFont, type CatalogVariable, type DesignElement, type DesignScene, type Typography } from './scene';
import { ancestors, flatten, groupOffsetAt, pinOffsetAt, resolveColor, stateAt, visibleAt } from './scene-ops';
import { pathD } from '@zouriel/ui/canvas';
import { pathFill } from './shape-paths';
import { marksSvg, resolvePattern, type ResolvedPattern } from '../render/patterns';
import { isBlendMode, resolveBevel, resolveGlow, type ResolvedBevel, type ResolvedGlow } from '../render/effects';
import { isExtraShape, isMaskKind, shapeD } from '../render/shapes';
import { resolveGradient } from '../render/gradient';

/** The gallery card's shape: portrait 9:16, as the template guide asks. */
export const POSTER_WIDTH = 720;
export const POSTER_HEIGHT = 1280;

export interface PosterContext {
  fonts: CatalogFont[];
  variables: CatalogVariable[];
}

/**
 * Paints the scene as it looks at a scroll position — the frame the designer chose — onto a canvas.
 *
 * <p>The live preview is a sandboxed document on an opaque origin, which nothing on this page is
 * allowed to screenshot. So the poster is drawn from the scene itself: close to the real render
 * (same positions, motion state, colours, fonts and sample text), not pixel-identical, and the owner
 * can upload their own instead.</p>
 */
export async function renderPoster(scene: DesignScene, scroll: number, ctx: PosterContext): Promise<Blob> {
  const canvas = await paint(scene, scroll, ctx, POSTER_WIDTH, POSTER_HEIGHT);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob && blob.type === 'image/webp') resolve(blob);
      // Safari can't encode WebP; PNG is accepted too.
      else canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('Could not draw the poster.'))), 'image/png');
    }, 'image/webp', 0.9));
}

/**
 * One phone screen of the design (390 wide, 844 tall in design units) as a JPEG data: URI, for the
 * assistant to look at. Drawn like the poster: close to the page, not pixel-identical.
 */
export async function renderScreen(scene: DesignScene, scroll: number, ctx: PosterContext, width = CANVAS_WIDTH): Promise<string> {
  const canvas = await paint(scene, scroll, ctx, width, Math.round((width * 844) / CANVAS_WIDTH));
  return canvas.toDataURL('image/jpeg', 0.72);
}

async function paint(scene: DesignScene, scroll: number, ctx: PosterContext, width: number, height: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  const unit = width / CANVAS_WIDTH;
  const viewHeight = height / unit;

  g.scale(unit, unit);
  g.translate(0, -scroll);
  g.fillStyle = resolveColor(scene, 'theme:bg', '#ffffff');
  g.fillRect(0, scroll, CANVAS_WIDTH, viewHeight);

  const images = await loadImages(scene);
  const patterns = await loadPatterns(scene);
  // Paint order, groups included: a child is drawn right after its group opens.
  for (const f of flatten(scene)) {
    const el = f.element;
    if (el.type === 'group') continue;
    // On a stage, outside its bar (or a group's) it isn't there.
    if (!visibleAt(scene, el, scroll)) continue;
    const offset = groupOffsetAt(scene, el.id, scroll);
    const s = stateAt(scene, el, scroll);
    let opacity = s.opacity;
    for (const group of ancestors(scene, el.id)) opacity *= stateAt(scene, group, scroll).opacity;
    if (opacity <= 0.01) continue;

    const x = s.x + offset.x;
    const y = s.y + offset.y + pinOffsetAt(scene, el, scroll);
    if (y > scroll + viewHeight || y + el.h * s.scale < scroll) continue;

    g.save();
    g.globalAlpha = opacity;
    g.translate(x + el.w / 2, y + el.h / 2);
    g.rotate((s.rotate * Math.PI) / 180);
    g.scale(s.scale, s.scale);
    g.translate(-el.w / 2, -el.h / 2);
    try {
      const pattern = patterns.get(el.id) ?? null;
      const fx = effectsOf(scene, el);
      if (fx.blend) g.globalCompositeOperation = fx.blend as GlobalCompositeOperation;
      // Its own clip to a shape (a group's is left to the page).
      if (el.mask && isMaskKind(el.mask.kind) && ['image', 'slot', 'svg'].includes(el.type)) {
        const d = shapeD(el.mask.kind, el.w, el.h, el.mask.sides ?? 6, el.mask.amount ?? null, 0);
        if (d) g.clip(new Path2D(d), 'evenodd');
      }
      if (pattern || fx.bevel || fx.inner || fx.outer || fx.shadow || (el.gradient && (el.type === 'svg' || el.type === 'image'))) drawLayered(g, scene, el, ctx, images, pattern, fx, unit * Math.max(0.05, Math.abs(s.scale)));
      else drawElement(g, scene, el, ctx, images);
    } finally {
      g.restore();
    }
  }
  return canvas;
}

function drawElement(g: CanvasRenderingContext2D, scene: DesignScene, el: DesignElement, ctx: PosterContext, images: Map<string, Drawable>): void {
  switch (el.type) {
    case 'text': {
      const text = (el.text?.runs ?? []).map((r) => (r.var ? sampleFor(scene, ctx, r.var) : r.text ?? '')).join('');
      const paint = el.gradient ? paintOf(g, scene, el, null) : null;
      if (el.text?.curve && Math.abs(el.text.curve) >= 0.5) drawCurvedText(g, scene, ctx, text, el.text.style, el.text.curve, el.w, el.h, paint);
      else drawText(g, scene, ctx, text, el.text!.style, 0, 0, el.w, el.h, paint);
      break;
    }
    case 'shape': {
      const shape = el.shape!;
      if (shape.kind === 'path' && shape.path) {
        const { closed, open } = pathFill(shape.path, el.w, el.h);
        if (closed.length) {
          const area = new Path2D(pathD(closed));
          const paint = paintOf(g, scene, el, shape.fill);
          if (shape.particles) drawParticles(g, scene, el, area);
          else if (paint) { g.fillStyle = paint; g.fill(area); }
          if (shape.stroke && shape.strokeWidth > 0) { g.strokeStyle = resolveColor(scene, shape.stroke); g.lineWidth = shape.strokeWidth; g.stroke(area); }
        }
        if (open.length) {
          g.strokeStyle = resolveColor(scene, shape.stroke ?? shape.fill ?? null, '#000');
          g.lineWidth = shape.strokeWidth || 2;
          g.lineCap = 'round';
          g.stroke(new Path2D(pathD(open)));
        }
        break;
      }
      if (isExtraShape(shape.kind)) {
        const area = new Path2D(shapeD(shape.kind, el.w, el.h, shape.sides, shape.amount ?? null, Math.min(shape.radius, el.w / 2, el.h / 2)) ?? '');
        const paint = paintOf(g, scene, el, shape.fill);
        if (shape.particles) drawParticles(g, scene, el, area, 'evenodd');
        else if (paint) { g.fillStyle = paint; g.fill(area, 'evenodd'); }
        if (shape.stroke && shape.strokeWidth > 0) { g.strokeStyle = resolveColor(scene, shape.stroke); g.lineWidth = shape.strokeWidth; dashOf(g, shape.dash, shape.strokeWidth); g.stroke(area); }
        break;
      }
      g.beginPath();
      if (shape.kind === 'ellipse') g.ellipse(el.w / 2, el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
      else if (shape.kind === 'line') { g.moveTo(0, el.h / 2); g.lineTo(el.w, el.h / 2); }
      else if (shape.kind === 'polygon') {
        const sides = Math.max(3, Math.min(12, shape.sides));
        for (let i = 0; i < sides; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
          const px = el.w / 2 + (el.w / 2) * Math.cos(a);
          const py = el.h / 2 + (el.h / 2) * Math.sin(a);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
      } else g.roundRect(0, 0, el.w, el.h, Math.min(shape.radius, el.w / 2, el.h / 2));
      const paint = shape.kind !== 'line' ? paintOf(g, scene, el, shape.fill) : null;
      if (shape.particles && shape.kind !== 'line') drawParticles(g, scene, el);
      else if (paint) { g.fillStyle = paint; g.fill(); }
      const stroke = shape.stroke ?? (shape.kind === 'line' ? shape.fill : null);
      if (stroke || (shape.kind === 'line' && el.gradient)) {
        g.strokeStyle = (shape.kind === 'line' ? paintOf(g, scene, el, stroke ?? null) : null) ?? resolveColor(scene, stroke ?? null);
        g.lineWidth = shape.strokeWidth || (shape.kind === 'line' ? 2 : 1);
        dashOf(g, shape.dash, g.lineWidth);
        g.stroke();
      }
      break;
    }
    case 'svg':
    case 'image': {
      const img = images.get(el.id);
      if (!img) break;
      const fit = el.type === 'image' ? (el.image?.fit === 'stretch' ? 'fill' : el.image?.fit ?? 'contain') : el.svg?.stretch ? 'fill' : 'contain';
      const look = adjustFilter(el.image?.adjust);
      if (look) g.filter = look;
      drawFitted(g, img, el.w, el.h, fit, el.image?.radius ?? 0);
      if (look) g.filter = 'none';
      break;
    }
    case 'slot': {
      const slot = el.slot!;
      if (slot.multiple) {
        const cols = Math.max(1, Math.min(6, slot.columns));
        const cw = (el.w - slot.gap * (cols - 1)) / cols;
        const ch = cw / Math.max(0.2, slot.aspect);
        let i = 0;
        for (let row = 0; (row + 1) * ch + row * slot.gap <= el.h + 0.5 && i < 12; row++)
          for (let c = 0; c < cols; c++, i++) placeholder(g, c * (cw + slot.gap), row * (ch + slot.gap), cw, ch, slot.radius, i);
      } else {
        const look = adjustFilter(slot.adjust);
        if (look) g.filter = look;
        placeholder(g, 0, 0, el.w, el.h, slot.radius, 0);
        if (look) g.filter = 'none';
      }
      break;
    }
    case 'rsvp':
    case 'link': {
      const b = el.button!;
      g.beginPath();
      g.roundRect(0, 0, el.w, el.h, Math.min(b.radius, el.h / 2, el.w / 2));
      const paint = paintOf(g, scene, el, b.fill);
      if (paint) { g.fillStyle = paint; g.fill(); }
      if (b.stroke && b.strokeWidth) { g.strokeStyle = resolveColor(scene, b.stroke); g.lineWidth = b.strokeWidth; g.stroke(); }
      drawText(g, scene, ctx, el.type === 'rsvp' ? 'Reply now' : b.label, { ...b.style, valign: 'middle' }, 12, 0, el.w - 24, el.h);
      break;
    }
    case 'dress': {
      const d = el.dress!;
      const swatches = ['#1b3d59', '#d4eef8', '#f3eed8'];
      const total = swatches.length * d.swatch + (swatches.length - 1) * d.gap;
      let sx = d.style.align === 'left' ? 0 : d.style.align === 'right' ? el.w - total : (el.w - total) / 2;
      for (const c of swatches) {
        g.beginPath();
        if (d.shape === 'square') g.roundRect(sx, 0, d.swatch, d.swatch, 6);
        else g.arc(sx + d.swatch / 2, d.swatch / 2, d.swatch / 2, 0, Math.PI * 2);
        g.fillStyle = c;
        g.fill();
        sx += d.swatch + d.gap;
      }
      break;
    }
  }
}

/** An element's gradient as a canvas paint over its box, else its colour; null when it has neither. */
/** How many particles per 1000 square units, and their size, as the page's particle script has them. */
const PARTICLE_LOOK: Record<string, [number, number]> = {
  dust: [3, 1.5], stars: [1.2, 1.8], glitter: [2.2, 1.5], snow: [1.6, 2.4], confetti: [0.7, 4.5], hearts: [0.35, 6], bokeh: [0.14, 16], fireflies: [0.35, 2.6],
};

/**
 * A shape's particles on the share image: a still, seeded scatter of the same kind and colour, clipped to
 * the shape (its current path, or `area`). Dots are their own paths, so the outline drawn next still uses
 * the shape's.
 */
function drawParticles(g: CanvasRenderingContext2D, scene: DesignScene, el: DesignElement, area?: Path2D, rule: CanvasFillRule = 'nonzero'): void {
  const p = el.shape!.particles!;
  const look = PARTICLE_LOOK[p.kind];
  if (!look) return;
  let seed = [...el.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const amount = p.amount ?? 0.5, size = p.size ?? 0.5;
  const n = Math.max(3, Math.min(p.kind === 'bokeh' ? 40 : 600, Math.round(((el.w * el.h) / 1000) * look[0] * (0.25 + amount * 1.75))));
  const col = resolveColor(scene, p.color ?? el.shape!.fill ?? null, '#ffffff');
  g.save();
  if (area) g.clip(area, rule);
  else g.clip();
  g.fillStyle = col;
  g.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    const x = rnd() * el.w, y = rnd() * el.h, r = (0.5 + rnd()) * look[1] * (0.4 + size * 1.2);
    const dot = new Path2D();
    g.globalAlpha = p.kind === 'bokeh' ? 0.25 : p.kind === 'dust' ? 0.6 : 0.85;
    if (p.kind === 'confetti') dot.rect(x - r / 2, y - r / 4, r, r / 2);
    else dot.arc(x, y, p.kind === 'stars' || p.kind === 'glitter' ? r * 0.6 : r, 0, Math.PI * 2);
    g.fill(dot);
    if ((p.kind === 'stars' || p.kind === 'glitter') && r > 2) {
      const ray = new Path2D();
      ray.moveTo(x - r * 1.8, y); ray.lineTo(x + r * 1.8, y); ray.moveTo(x, y - r * 1.8); ray.lineTo(x, y + r * 1.8);
      g.lineWidth = Math.max(0.6, r * 0.25);
      g.stroke(ray);
    }
  }
  g.restore();
}

function paintOf(g: CanvasRenderingContext2D, scene: DesignScene, el: DesignElement, fill: string | null | undefined): string | CanvasGradient | null {
  const gr = el.gradient ? resolveGradient(
    { type: el.gradient.type ?? null, angle: el.gradient.angle ?? 180, stops: el.gradient.stops.map((t) => ({ color: t.color, at: t.at ?? null })) },
    (ref) => (ref ? resolveColor(scene, ref, '') || null : null),
  ) : null;
  if (!gr) return fill ? resolveColor(scene, fill) : null;
  let paint: CanvasGradient;
  if (gr.type === 'radial') paint = g.createRadialGradient(el.w / 2, el.h / 2, 0, el.w / 2, el.h / 2, 0.7071 * Math.max(el.w, el.h));
  else {
    const rad = (gr.angle * Math.PI) / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
    const half = (Math.abs(el.w * dx) + Math.abs(el.h * dy)) / 2;
    paint = g.createLinearGradient(el.w / 2 - dx * half, el.h / 2 - dy * half, el.w / 2 + dx * half, el.h / 2 + dy * half);
  }
  for (const s of gr.stops) paint.addColorStop(s.at, s.color);
  return paint;
}

function dashOf(g: CanvasRenderingContext2D, dash: string | null | undefined, width: number): void {
  if (dash === 'dashed') g.setLineDash([width * 3, width * 2]);
  else if (dash === 'dotted') { g.setLineDash([0, width * 2]); g.lineCap = 'round'; }
}

/** A picture's look as a canvas filter (duotone and grain are left to the page). */
function adjustFilter(a: { brightness?: number; contrast?: number; saturation?: number; sepia?: number } | null | undefined): string | null {
  if (!a) return null;
  const parts: string[] = [];
  if (a.brightness != null && a.brightness !== 1) parts.push(`brightness(${a.brightness})`);
  if (a.contrast != null && a.contrast !== 1) parts.push(`contrast(${a.contrast})`);
  if (a.saturation != null && a.saturation !== 1) parts.push(`saturate(${a.saturation})`);
  if (a.sepia) parts.push(`sepia(${a.sepia})`);
  return parts.length ? parts.join(' ') : null;
}

/** One line of text along the page's arc, letter by letter. */
function drawCurvedText(g: CanvasRenderingContext2D, scene: DesignScene, ctx: PosterContext, text: string, style: Typography, curve: number, w: number, h: number, paint: string | CanvasGradient | null): void {
  const family = fontFamily(scene, ctx, style.font);
  const size = Math.max(4, Math.min(400, style.size));
  g.font = `${style.italic ? 'italic ' : ''}${style.weight} ${size}px ${family}`;
  g.fillStyle = paint ?? resolveColor(scene, style.color, '#111111');
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const content = (style.uppercase ? text.toUpperCase() : text).replace(/\n/g, ' ');
  const bend = Math.max(-100, Math.min(100, curve));
  const theta = (Math.abs(bend) / 100) * 2 * Math.PI * 0.97;
  const R = w / theta;
  const up = bend > 0;
  const my = h / 2 + (up ? size * 0.35 : -size * 0.35 + size * 0.7);
  const cy = up ? my + R : my - R;
  const total = g.measureText(content).width;
  let along = -total / 2;
  for (const ch of Array.from(content)) {
    const cw = g.measureText(ch).width;
    const a = (along + cw / 2) / R;
    g.save();
    if (up) { g.translate(w / 2 + R * Math.sin(a), cy - R * Math.cos(a)); g.rotate(a); }
    else { g.translate(w / 2 + R * Math.sin(a), cy + R * Math.cos(a)); g.rotate(-a); }
    if (style.stroke && style.strokeWidth) { g.strokeStyle = resolveColor(scene, style.stroke); g.lineWidth = style.strokeWidth * 2; g.lineJoin = 'round'; g.strokeText(ch, 0, 0); }
    g.fillText(ch, 0, 0);
    g.restore();
    along += cw;
  }
}

function drawText(g: CanvasRenderingContext2D, scene: DesignScene, ctx: PosterContext, text: string, style: Typography, x: number, y: number, w: number, h: number, paint: string | CanvasGradient | null = null): void {
  const family = fontFamily(scene, ctx, style.font);
  g.font = `${style.italic ? 'italic ' : ''}${style.weight} ${style.size}px ${family}`;
  g.fillStyle = paint ?? resolveColor(scene, style.color, '#111111');
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${style.letterSpacing}em`;
  const content = style.uppercase ? text.toUpperCase() : text;

  const lines: string[] = [];
  for (const paragraph of content.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      const next = line + word;
      if (g.measureText(next).width > w && line.trim()) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    lines.push(line);
  }
  const lineHeight = style.size * style.lineHeight;
  const blockHeight = lines.length * lineHeight;
  let top = style.valign === 'top' ? y : style.valign === 'bottom' ? y + h - blockHeight : y + (h - blockHeight) / 2;
  g.textAlign = style.align === 'left' ? 'left' : style.align === 'right' ? 'right' : 'center';
  const ax = style.align === 'left' ? x : style.align === 'right' ? x + w : x + w / 2;
  for (const line of lines) {
    // Baseline sits roughly 78% down the line box, as it does for most text faces.
    if (style.stroke && style.strokeWidth) {
      g.strokeStyle = resolveColor(scene, style.stroke);
      g.lineWidth = style.strokeWidth * 2;
      g.lineJoin = 'round';
      g.strokeText(line, ax, top + lineHeight / 2 + style.size * 0.35);
    }
    g.fillText(line, ax, top + lineHeight / 2 + style.size * 0.35);
    top += lineHeight;
  }
}

function fontFamily(scene: DesignScene, ctx: PosterContext, ref: string | null | undefined): string {
  let id = ref ?? '';
  if (id.startsWith('theme:')) id = scene.theme.find((t) => t.key === id.slice(6))?.value ?? '';
  const font = ctx.fonts.find((f) => f.id === id);
  return font ? `"${font.name}", ${font.fallback}` : 'system-ui, sans-serif';
}

function sampleFor(scene: DesignScene, ctx: PosterContext, path: string): string {
  const custom = scene.fields.find((f) => f.path === path);
  if (custom) return custom.sample || custom.label;
  return ctx.variables.find((v) => v.path === path)?.sample ?? '';
}

function placeholder(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, seed: number): void {
  const pairs = [['#b3d5f1', '#1b3d59'], ['#f3eed8', '#6a97c0'], ['#d4eef8', '#152026'], ['#6a97c0', '#f3eed8']];
  const [a, b] = pairs[seed % pairs.length];
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  g.clip();
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(x, y + h * 0.82);
  g.lineTo(x + w * 0.3, y + h * 0.55);
  g.lineTo(x + w * 0.55, y + h * 0.75);
  g.lineTo(x + w * 0.75, y + h * 0.6);
  g.lineTo(x + w, y + h * 0.8);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.fill();
  g.restore();
}

type Drawable = HTMLImageElement | HTMLCanvasElement;

function drawFitted(g: CanvasRenderingContext2D, img: Drawable, w: number, h: number, fit: 'cover' | 'contain' | 'fill', radius: number): void {
  const iw = ('naturalWidth' in img ? img.naturalWidth : img.width) || w;
  const ih = ('naturalHeight' in img ? img.naturalHeight : img.height) || h;
  const scale = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = fit === 'fill' ? w : iw * scale;
  const dh = fit === 'fill' ? h : ih * scale;
  g.save();
  if (radius > 0) {
    g.beginPath();
    g.roundRect(0, 0, w, h, Math.min(radius, w / 2, h / 2));
    g.clip();
  }
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  g.restore();
}

/** Every SVG and picture on the page, as drawable images, with SVG colours mapped as the element maps them. */
async function decoded(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

interface PosterPattern { p: ResolvedPattern; colour: string; marks: HTMLImageElement; pad: number }

/** A pattern drawn past the box by this share of its size, for text and strokes that overflow it. */
const PATTERN_PAD = 0.25;

/**
 * Each patterned leaf's pattern (its own, or the nearest group's), with its marks drawn over its box.
 * The page lays a group's pattern over the group as one; here each piece gets it in its own box: close,
 * not identical.
 */
async function loadPatterns(scene: DesignScene): Promise<Map<string, PosterPattern>> {
  const out = new Map<string, PosterPattern>();
  await Promise.all(flatten(scene).map(async ({ element: el }) => {
    if (el.type === 'group') return;
    const source = [el, ...ancestors(scene, el.id).reverse()].find((e) => e.pattern);
    const raw = source?.pattern;
    const p = raw ? resolvePattern({ kind: raw.kind, mode: raw.mode ?? null, size: raw.size ?? 1, strength: raw.strength ?? 0.5 }) : null;
    if (!p) return;
    const pad = PATTERN_PAD * Math.max(el.w, el.h);
    const svg = marksSvg(p.kind, p.size, -pad, -pad, el.w + 2 * pad, el.h + 2 * pad);
    try {
      const marks = await decoded('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
      const colour = p.mode === 'shine' ? '#ffffff' : p.mode === 'colour' ? resolveColor(scene, raw!.color ?? null, '#000000') : '#000000';
      out.set(el.id, { p, colour, marks, pad });
    } catch {
      // Without its marks the element is drawn plain.
    }
  }));
  return out;
}

interface PosterEffects {
  bevel: ResolvedBevel | null;
  inner: { g: ResolvedGlow; colour: string } | null;
  outer: { g: ResolvedGlow; colour: string } | null;
  blend: string | null;
  shadow: { x: number; y: number; blur: number; strength: number; colour: string } | null;
  light: { angle: number; colour: string };
}

/**
 * A leaf's effects: each its own or the nearest group's. The page applies a group's effects to the
 * group as one; here each piece gets them in its own box: close, not identical.
 */
function effectsOf(scene: DesignScene, el: DesignElement): PosterEffects {
  const chain = [el, ...ancestors(scene, el.id).reverse()];
  const bevel = chain.find((e) => e.bevel)?.bevel;
  const inner = chain.find((e) => e.innerGlow)?.innerGlow;
  const outer = chain.find((e) => e.outerGlow)?.outerGlow;
  const blend = chain.find((e) => e.blend && e.blend !== 'normal')?.blend ?? null;
  const light = chain.find((e) => e.light)?.light ?? null;
  const ig = inner ? resolveGlow({ size: inner.size ?? 10, strength: inner.strength ?? 0.75, blend: inner.blend ?? null }, 'screen') : null;
  const og = outer ? resolveGlow({ size: outer.size ?? 10, strength: outer.strength ?? 0.75, blend: null }, 'normal') : null;
  return {
    bevel: bevel ? resolveBevel({ style: bevel.style ?? null, size: bevel.size ?? 4, strength: bevel.strength ?? 0.7 }) : null,
    inner: ig ? { g: ig, colour: resolveColor(scene, inner!.color ?? null, '#ffffff') } : null,
    outer: og ? { g: og, colour: resolveColor(scene, outer!.color ?? null, '#ffffff') } : null,
    blend: isBlendMode(blend) && blend !== 'normal' ? blend : null,
    shadow: el.shadow && (el.shadow.strength ?? 0.35) > 0
      ? { x: el.shadow.x ?? 0, y: el.shadow.y ?? 4, blur: el.shadow.blur ?? 8, strength: Math.min(1, el.shadow.strength ?? 0.35), colour: resolveColor(scene, el.shadow.color ?? null, '#000000') }
      : null,
    light: { angle: light?.angle ?? 135, colour: resolveColor(scene, light?.color ?? null, '#ffffff') },
  };
}

function blankLike(c: HTMLCanvasElement): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const out = document.createElement('canvas');
  out.width = c.width;
  out.height = c.height;
  return { c: out, g: out.getContext('2d')! };
}

/**
 * `src`'s alpha, blurred (radius in pixels) and painted in a colour. A shadow cast from off the canvas
 * does the blur: every browser draws shadows, not every one a canvas filter.
 */
function blurredShape(src: HTMLCanvasElement, radius: number, colour: string): HTMLCanvasElement {
  const { c, g } = blankLike(src);
  g.shadowColor = colour;
  g.shadowBlur = Math.max(0, radius);
  g.shadowOffsetX = src.width * 2;
  g.drawImage(src, -src.width * 2, 0);
  // Left on, the shadow would be cast by whatever is drawn next, and a destination-in clears the
  // canvas with it.
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetX = 0;
  return c;
}

/**
 * The element drawn on its own layer with its pattern over what it paints (shade, shine and colour lay
 * the marks over it; emboss and engrave light their edges), then its inner glow and bevel, then onto
 * the poster over its outer glow.
 */
function drawLayered(g: CanvasRenderingContext2D, scene: DesignScene, el: DesignElement, ctx: PosterContext, images: Map<string, Drawable>, pat: PosterPattern | null, fx: PosterEffects, pixels: number): void {
  const pad = Math.max(pat?.pad ?? 0, PATTERN_PAD * Math.max(el.w, el.h), fx.outer ? fx.outer.g.size * 1.5 + 2 : 0,
    fx.shadow ? Math.max(Math.abs(fx.shadow.x), Math.abs(fx.shadow.y)) + fx.shadow.blur * 1.5 + 2 : 0);
  const bw = el.w + 2 * pad, bh = el.h + 2 * pad;
  const W = Math.max(1, Math.min(4096, Math.ceil(bw * pixels))), H = Math.max(1, Math.min(4096, Math.ceil(bh * pixels)));
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const lg = layer.getContext('2d');
  if (!lg) { drawElement(g, scene, el, ctx, images); return; }
  const px = W / bw;
  lg.scale(px, H / bh);
  lg.translate(pad, pad);
  drawElement(lg, scene, el, ctx, images);
  // A picture or illustration with a gradient is its silhouette, painted in it.
  if (el.gradient && (el.type === 'svg' || el.type === 'image')) {
    const paint = paintOf(lg, scene, el, null);
    if (paint) { lg.globalCompositeOperation = 'source-in'; lg.fillStyle = paint; lg.fillRect(0, 0, el.w, el.h); lg.globalCompositeOperation = 'source-over'; }
  }
  lg.setTransform(1, 0, 0, 1, 0, 0);
  // The shape as it was painted, before anything is laid over it.
  const shape = blankLike(layer);
  shape.g.drawImage(layer, 0, 0);

  if (pat) {
    // The marks cover the pattern's own padded box, placed inside this one.
    const mx = (pad - pat.pad) * px, mw = (el.w + 2 * pat.pad) * px, mh = (el.h + 2 * pat.pad) * (H / bh);
    const marks = (colour: string, dx = 0, dy = 0, cut = false) => {
      const { c: m, g: mg } = blankLike(layer);
      mg.drawImage(pat.marks, mx + dx, mx + dy, mw, mh);
      // Only the rim the shift uncovers: the marks' edge on one side.
      if (cut) { mg.globalCompositeOperation = 'destination-out'; mg.drawImage(pat.marks, mx, mx, mw, mh); }
      mg.globalCompositeOperation = 'source-in';
      mg.fillStyle = colour;
      mg.fillRect(0, 0, W, H);
      return m;
    };
    lg.globalCompositeOperation = 'source-atop';
    if (pat.p.mode === 'emboss' || pat.p.mode === 'engrave') {
      const d = Math.max(1, 1.5 * pixels) * (pat.p.mode === 'emboss' ? 1 : -1);
      lg.globalAlpha = pat.p.strength * 0.8;
      lg.drawImage(marks('#000000', d, d, true), 0, 0);
      lg.drawImage(marks('#ffffff', -d, -d, true), 0, 0);
    } else {
      lg.globalAlpha = pat.p.strength;
      lg.drawImage(marks(pat.colour), 0, 0);
    }
    lg.globalAlpha = 1;
  }

  if (fx.inner) {
    // The outside, blurred in over the edge, kept inside and laid over in the glow's blend.
    const outside = blankLike(layer);
    outside.g.fillRect(0, 0, W, H);
    outside.g.globalCompositeOperation = 'destination-out';
    outside.g.drawImage(shape.c, 0, 0);
    const glow = blurredShape(outside.c, fx.inner.g.size * pixels, fx.inner.colour);
    const gg = glow.getContext('2d')!;
    gg.globalCompositeOperation = 'destination-in';
    gg.drawImage(shape.c, 0, 0);
    lg.globalCompositeOperation = fx.inner.g.blend as GlobalCompositeOperation;
    lg.globalAlpha = fx.inner.g.strength;
    lg.drawImage(glow, 0, 0);
    lg.drawImage(glow, 0, 0);
    lg.globalAlpha = 1;
  }

  if (fx.bevel) {
    // A light rim on the side facing the light (top left) and a dark one opposite, softened and kept
    // inside; pressed in swaps them.
    const d = Math.max(1, fx.bevel.size * 0.6 * pixels);
    // The light's direction on screen (its angle counts counter-clockwise from the right).
    const la = (fx.light.angle * Math.PI) / 180;
    const ax = -Math.cos(la), ay = Math.sin(la);
    const rim = (sign: number, colour: string) => {
      const r = blankLike(layer);
      r.g.drawImage(shape.c, 0, 0);
      r.g.globalCompositeOperation = 'destination-out';
      r.g.drawImage(shape.c, sign * ax * d, sign * ay * d);
      const soft = blurredShape(r.c, fx.bevel!.size * 0.5 * pixels, colour);
      const sg = soft.getContext('2d')!;
      sg.globalCompositeOperation = 'destination-in';
      sg.drawImage(shape.c, 0, 0);
      return soft;
    };
    const raised = fx.bevel.style !== 'pressed';
    lg.globalCompositeOperation = 'source-atop';
    lg.globalAlpha = fx.bevel.strength * 0.85;
    lg.drawImage(rim(raised ? 1 : -1, fx.light.colour), 0, 0);
    lg.drawImage(rim(raised ? -1 : 1, '#000000'), 0, 0);
    lg.globalAlpha = 1;
  }

  if (fx.shadow) {
    const cast = blurredShape(shape.c, fx.shadow.blur * pixels, fx.shadow.colour);
    const keep = g.globalAlpha;
    g.globalAlpha = keep * fx.shadow.strength;
    g.drawImage(cast, -pad + fx.shadow.x, -pad + fx.shadow.y, bw, bh);
    g.globalAlpha = keep;
  }
  if (fx.outer) {
    const glow = blurredShape(shape.c, fx.outer.g.size * pixels, fx.outer.colour);
    const keep = g.globalAlpha;
    g.globalAlpha = keep * fx.outer.g.strength;
    g.drawImage(glow, -pad, -pad, bw, bh);
    g.drawImage(glow, -pad, -pad, bw, bh);
    g.globalAlpha = keep;
  }
  g.drawImage(layer, -pad, -pad, bw, bh);
}

/**
 * A tinted picture as the page draws it: a silhouette through its own alpha (or, opaque, through its
 * brightness mask), or the photo with the colour multiplied over it.
 */
async function tinted(img: HTMLImageElement, asset: { alpha?: boolean | null; mask?: string | null }, tint: string, mode: string | null): Promise<Drawable> {
  const opaque = asset.alpha === false;
  const overlay = opaque && (mode === 'overlay' || !asset.mask);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const g = canvas.getContext('2d');
  if (!g) return img;
  if (overlay) {
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    g.drawImage(opaque ? await decoded(asset.mask!) : img, 0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = tint;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

async function loadImages(scene: DesignScene): Promise<Map<string, Drawable>> {
  const out = new Map<string, Drawable>();
  await Promise.all(flatten(scene).map(async ({ element: el }) => {
    let src: string | null = null;
    if (el.type === 'image' && el.image) src = scene.assets[el.image.asset]?.data ?? null;
    if (el.type === 'svg' && el.svg) {
      const asset = scene.assets[el.svg.asset];
      if (asset) {
        let markup = asset.data;
        // A tint paints every colour, currentColor and the default black in one colour, as the page does.
        const tint = el.svg.tint ? resolveColor(scene, el.svg.tint, '') : '';
        (asset.colors ?? []).forEach((color, i) => {
          const mapped = el.svg!.fills[color];
          const value = tint || (mapped ? resolveColor(scene, mapped, color) : color);
          markup = markup.replaceAll(`var(--c${i}, ${color})`, value);
        });
        if (tint) {
          markup = markup
            .replace(/var\(--cu, url\(#[^)]*\)\)/g, tint)
            // Art sanitised before gradients went through --cu.
            .replace(/\b(fill|stroke)="url\(#[^)]*\)"/g, `$1="${tint}"`)
            .replace(/\b(fill|stroke):url\(#[^)]*\)/g, `$1:${tint}`)
            .replaceAll('currentColor', tint)
            .replace(/<svg\b/, `<svg fill="${tint}"`);
        }
        src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
      }
    }
    if (!src) return;
    try {
      const img = await decoded(src);
      const asset = el.type === 'image' && el.image ? scene.assets[el.image.asset] : undefined;
      const tint = el.type === 'image' && el.image?.tint ? resolveColor(scene, el.image.tint, '') : '';
      out.set(el.id, tint && asset ? await tinted(img, asset, tint, el.image!.tintMode ?? null) : img);
    } catch {
      // Undrawable assets are simply left off the poster.
    }
  }));
  return out;
}

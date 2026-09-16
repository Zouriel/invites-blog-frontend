import { CANVAS_WIDTH, type CatalogFont, type CatalogVariable, type DesignElement, type DesignScene, type Typography } from './scene';
import { ancestors, flatten, groupOffsetAt, pinOffsetAt, resolveColor, sectionTops, stateAt } from './scene-ops';

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
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const g = canvas.getContext('2d')!;
  const unit = POSTER_WIDTH / CANVAS_WIDTH;
  const viewHeight = POSTER_HEIGHT / unit;

  g.scale(unit, unit);
  g.translate(0, -scroll);
  g.fillStyle = resolveColor(scene, 'theme:bg', '#ffffff');
  g.fillRect(0, scroll, CANVAS_WIDTH, viewHeight);

  const tops = sectionTops(scene);
  scene.canvas.sections.forEach((s, i) => {
    if (!s.background) return;
    g.fillStyle = resolveColor(scene, s.background, 'transparent');
    g.fillRect(0, tops[i], CANVAS_WIDTH, s.height);
  });

  const images = await loadImages(scene);
  // Paint order, groups included: a child is drawn right after its group opens.
  for (const f of flatten(scene)) {
    const el = f.element;
    if (el.type === 'group') continue;
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
      drawElement(g, scene, el, ctx, images);
    } finally {
      g.restore();
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob && blob.type === 'image/webp') resolve(blob);
      // Safari can't encode WebP; PNG is accepted too.
      else canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('Could not draw the poster.'))), 'image/png');
    }, 'image/webp', 0.9));
}

function drawElement(g: CanvasRenderingContext2D, scene: DesignScene, el: DesignElement, ctx: PosterContext, images: Map<string, HTMLImageElement>): void {
  switch (el.type) {
    case 'text': {
      const text = (el.text?.runs ?? []).map((r) => (r.var ? sampleFor(scene, ctx, r.var) : r.text ?? '')).join('');
      drawText(g, scene, ctx, text, el.text!.style, 0, 0, el.w, el.h);
      break;
    }
    case 'shape': {
      const shape = el.shape!;
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
      if (shape.kind !== 'line' && shape.fill) { g.fillStyle = resolveColor(scene, shape.fill); g.fill(); }
      const stroke = shape.stroke ?? (shape.kind === 'line' ? shape.fill : null);
      if (stroke) {
        g.strokeStyle = resolveColor(scene, stroke);
        g.lineWidth = shape.strokeWidth || (shape.kind === 'line' ? 2 : 1);
        g.stroke();
      }
      break;
    }
    case 'svg':
    case 'image': {
      const img = images.get(el.id);
      if (!img) break;
      const fit = el.type === 'image' ? el.image?.fit ?? 'contain' : 'contain';
      drawFitted(g, img, el.w, el.h, fit, el.image?.radius ?? 0);
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
        placeholder(g, 0, 0, el.w, el.h, slot.radius, 0);
      }
      break;
    }
    case 'rsvp':
    case 'link': {
      const b = el.button!;
      g.beginPath();
      g.roundRect(0, 0, el.w, el.h, Math.min(b.radius, el.h / 2, el.w / 2));
      if (b.fill) { g.fillStyle = resolveColor(scene, b.fill); g.fill(); }
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

function drawText(g: CanvasRenderingContext2D, scene: DesignScene, ctx: PosterContext, text: string, style: Typography, x: number, y: number, w: number, h: number): void {
  const family = fontFamily(scene, ctx, style.font);
  g.font = `${style.italic ? 'italic ' : ''}${style.weight} ${style.size}px ${family}`;
  g.fillStyle = resolveColor(scene, style.color, '#111111');
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

function drawFitted(g: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, fit: 'cover' | 'contain', radius: number): void {
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  const scale = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
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
async function loadImages(scene: DesignScene): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(flatten(scene).map(async ({ element: el }) => {
    let src: string | null = null;
    if (el.type === 'image' && el.image) src = scene.assets[el.image.asset]?.data ?? null;
    if (el.type === 'svg' && el.svg) {
      const asset = scene.assets[el.svg.asset];
      if (asset) {
        let markup = asset.data;
        (asset.colors ?? []).forEach((color, i) => {
          const mapped = el.svg!.fills[color];
          const value = mapped ? resolveColor(scene, mapped, color) : color;
          markup = markup.replaceAll(`var(--c${i}, ${color})`, value);
        });
        src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
      }
    }
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    try {
      await img.decode();
      out.set(el.id, img);
    } catch {
      // Undrawable assets are simply left off the poster.
    }
  }));
  return out;
}

import { polygonContour, type UiPathContour } from '@zouriel/ui/canvas';
import type { DesignElement, DesignScene } from './scene';
import { resolveColor } from './scene-ops';

/**
 * A small still of shapes for the editor's own tiles (generators, repeat): rectangles, ovals, polygons
 * and drawn shapes, groups included, in the theme's colours. Only shapes are drawn; it isn't the compiler.
 * Colours are checked to be plain colours before they go into the markup.
 */
export function miniSvg(scene: DesignScene, el: DesignElement, pad = 8): string {
  const marks: string[] = [];
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  draw(scene, el, 0, 0, marks, box);
  if (!marks.length || !Number.isFinite(box.x0)) return '';
  const w = Math.max(1, box.x1 - box.x0 + pad * 2);
  const h = Math.max(1, box.y1 - box.y0 + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(box.x0 - pad)} ${n(box.y0 - pad)} ${n(w)} ${n(h)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${marks.join('')}</svg>`;
}

const n = (v: number) => Math.round(v * 100) / 100;

function safe(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) || /^(none|transparent)$/.test(color) ? color : 'currentColor';
}

function draw(scene: DesignScene, el: DesignElement, ox: number, oy: number, out: string[], box: { x0: number; y0: number; x1: number; y1: number }): void {
  const x = ox + el.x;
  const y = oy + el.y;
  if (el.type === 'group') {
    for (const c of el.children ?? []) draw(scene, c, x, y, out, box);
    return;
  }
  if (el.type !== 'shape' || !el.shape) return;
  const s = el.shape;
  const fill = safe(resolveColor(scene, s.fill, 'none'));
  const stroke = s.strokeWidth > 0 ? safe(resolveColor(scene, s.stroke, 'none')) : 'none';
  const cx = x + el.w / 2;
  const cy = y + el.h / 2;
  const r = Math.max(el.w, el.h) * el.scale * 0.75;
  box.x0 = Math.min(box.x0, cx - r); box.y0 = Math.min(box.y0, cy - r);
  box.x1 = Math.max(box.x1, cx + r); box.y1 = Math.max(box.y1, cy + r);
  const transform = `translate(${n(cx)} ${n(cy)}) rotate(${n(el.rotate)}) scale(${n(el.scale)}) translate(${n(-el.w / 2)} ${n(-el.h / 2)})`;
  const paint = `fill="${fill}" stroke="${stroke}" stroke-width="${n(s.strokeWidth)}" stroke-linecap="round" opacity="${n(el.opacity)}"`;
  switch (s.kind) {
    case 'ellipse':
      out.push(`<ellipse transform="${transform}" cx="${n(el.w / 2)}" cy="${n(el.h / 2)}" rx="${n(el.w / 2)}" ry="${n(el.h / 2)}" ${paint}/>`);
      break;
    case 'polygon':
      out.push(`<path transform="${transform}" d="${pathD([polygonContour(0, 0, el.w, el.h, s.sides)])}" ${paint}/>`);
      break;
    case 'line':
      out.push(`<line transform="${transform}" x1="0" y1="${n(el.h / 2)}" x2="${n(el.w)}" y2="${n(el.h / 2)}" stroke="${fill === 'none' ? stroke : fill}" stroke-width="${n(Math.max(1, s.strokeWidth))}"/>`);
      break;
    case 'path': {
      const p = s.path;
      if (!p) break;
      const sx = el.w / Math.max(1, p.width);
      const sy = el.h / Math.max(1, p.height);
      out.push(`<path transform="${transform} scale(${n(sx)} ${n(sy)})" d="${pathD(p.contours)}" ${paint} vector-effect="non-scaling-stroke"/>`);
      break;
    }
    default:
      out.push(`<rect transform="${transform}" width="${n(el.w)}" height="${n(el.h)}" rx="${n(Math.min(s.radius, el.w / 2, el.h / 2))}" ${paint}/>`);
  }
}

/** SVG path data for outlines (curves where they have handles). */
export function pathD(contours: readonly UiPathContour[]): string {
  let d = '';
  for (const c of contours) {
    if (c.points.length < 2) continue;
    d += `M${n(c.points[0].x)} ${n(c.points[0].y)}`;
    const count = c.closed ? c.points.length : c.points.length - 1;
    for (let i = 0; i < count; i++) {
      const a = c.points[i];
      const b = c.points[(i + 1) % c.points.length];
      if (!a.out && !b.in) d += `L${n(b.x)} ${n(b.y)}`;
      else {
        const c1 = a.out ?? a;
        const c2 = b.in ?? b;
        d += `C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(b.x)} ${n(b.y)}`;
      }
    }
    if (c.closed) d += 'Z';
  }
  return d;
}

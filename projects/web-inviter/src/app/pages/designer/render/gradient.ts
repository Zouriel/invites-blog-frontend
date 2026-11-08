/**
 * Gradients that paint what an element draws (`DesignGradients` in C#; keep the two in step, byte for
 * byte). Colours come in already resolved (hex, or var(--ib-key) for a theme colour, so a host's
 * recolouring still reaches them). A shape gets an SVG gradient inside its own drawing; text, buttons,
 * pictures and illustrations get the same gradient as CSS.
 */
import { num } from './css';

export const GRADIENT_TYPES = ['linear', 'radial'] as const;
export const GRADIENT_MAX_STOPS = 6;

export interface ResolvedGradient { type: 'linear' | 'radial'; angle: number; stops: { color: string; at: number }[] }

/**
 * A gradient as the compiler uses it, or null when it hasn't two colours that resolve. `resolve`
 * turns a colour reference into CSS (null when it isn't one).
 */
export function resolveGradient(
  g: { type: string | null; angle: number; stops: { color: string | null; at: number | null }[] } | null,
  resolve: (ref: string | null) => string | null,
): ResolvedGradient | null {
  if (!g) return null;
  const kept = g.stops.slice(0, GRADIENT_MAX_STOPS).map((s) => ({ color: resolve(s.color), at: s.at })).filter((s) => s.color !== null);
  if (kept.length < 2) return null;
  const last = kept.length - 1;
  const stops = kept.map((s, i) => ({
    color: s.color!,
    at: s.at !== null && Number.isFinite(s.at) ? Math.min(1, Math.max(0, s.at)) : i / last,
  }));
  const angle = Number.isFinite(g.angle) ? ((g.angle % 360) + 360) % 360 : 180;
  return { type: g.type === 'radial' ? 'radial' : 'linear', angle, stops };
}

/** The gradient as a CSS image. */
export function gradientCss(g: ResolvedGradient): string {
  const stops = g.stops.map((s) => `${s.color} ${num(s.at * 100)}%`).join(',');
  return g.type === 'radial' ? `radial-gradient(ellipse farthest-corner,${stops})` : `linear-gradient(${num(g.angle)}deg,${stops})`;
}

/**
 * The gradient as an SVG paint server with an id, for a drawing whose viewBox is w × h: a linear one
 * runs exactly as CSS's does at the same angle (corner to corner of the box), a radial one reaches
 * the corners.
 */
export function gradientSvg(id: string, g: ResolvedGradient, w: number, h: number): string {
  const stops = g.stops.map((s) => `<stop offset="${num(s.at)}" style="stop-color:${s.color}"/>`).join('');
  if (g.type === 'radial')
    return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.7071">${stops}</radialGradient>`;
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.sin(rad), dy = -Math.cos(rad);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2, cy = h / 2;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(cx - dx * half)}" y1="${num(cy - dy * half)}" x2="${num(cx + dx * half)}" y2="${num(cy + dy * half)}">${stops}</linearGradient>`;
}

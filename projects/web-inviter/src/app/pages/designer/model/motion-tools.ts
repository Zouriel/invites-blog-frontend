import type { DesignElement, DesignKeyframe, DesignScene } from './scene';
import { ancestors, findElement, hasTrack, round, trackOf, updateElement } from './scene-ops';

export type StaggerOrder = 'forward' | 'reverse' | 'center' | 'random';

/**
 * Staggers a group's moving children: each one's bar starts `step` units of scroll after the one
 * before, in the chosen order, keeping its length. Written into the children's own tracks — nothing
 * new for the compiler — so the timeline shows exactly what plays, and any child can still be moved
 * by hand afterwards. Applying it again re-spaces from the earliest start, so it never accumulates.
 */
export function staggerChildren(scene: DesignScene, groupId: string, step: number, order: StaggerOrder = 'forward', seed = 1): DesignScene {
  const group = findElement(scene, groupId);
  if (!group?.children?.length) return scene;
  const moving = group.children.filter(hasTrack);
  if (moving.length < 2) return scene;
  const tracks = new Map(moving.map((c) => [c.id, trackOf(scene, c)]));
  const first = Math.min(...[...tracks.values()].map((t) => t.start));
  const n = moving.length;
  let ranks = moving.map((_, i) => i);
  if (order === 'reverse') ranks = ranks.map((i) => n - 1 - i);
  // From the middle outwards: the two either side of centre start together.
  else if (order === 'center') ranks = ranks.map((i) => Math.abs(i - (n - 1) / 2));
  else if (order === 'random') {
    const rnd = seeded(seed);
    const shuffled = ranks.map((i) => ({ i, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.i);
    ranks = moving.map((_, i) => shuffled.indexOf(i));
  }
  const byId = new Map(moving.map((c, i) => [c.id, ranks[i]]));
  return updateElement(scene, groupId, (g) => ({
    ...g,
    children: g.children!.map((c) => {
      const rank = byId.get(c.id);
      if (rank === undefined) return c;
      const t = tracks.get(c.id)!;
      const start = Math.max(0, round(first + rank * step, 1));
      return { ...c, track: { start, end: round(start + (t.end - t.start), 1) } };
    }),
  }));
}

/** Points along a shape's outline in page units: its drawn path, or an ellipse, box or line. */
export function outlineOf(scene: DesignScene, el: DesignElement): { x: number; y: number }[] {
  const offset = ancestors(scene, el.id).reduce((o, a) => ({ x: o.x + a.x, y: o.y + a.y }), { x: 0, y: 0 });
  const ox = el.x + offset.x;
  const oy = el.y + offset.y;
  const shape = el.shape;
  if (!shape) return [];
  const pts: { x: number; y: number }[] = [];
  if (shape.kind === 'path' && shape.path) {
    const sx = el.w / Math.max(1, shape.path.width);
    const sy = el.h / Math.max(1, shape.path.height);
    // The first contour is the path to follow; curves are cut into short straight pieces.
    const contour = shape.path.contours.find((c) => c.points.length > 1);
    if (!contour) return [];
    const p = contour.points;
    const count = contour.closed ? p.length : p.length - 1;
    pts.push({ x: ox + p[0].x * sx, y: oy + p[0].y * sy });
    for (let i = 0; i < count; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      const c1 = a.out ?? { x: a.x, y: a.y };
      const c2 = b.in ?? { x: b.x, y: b.y };
      for (let k = 1; k <= 16; k++) {
        const t = k / 16;
        const u = 1 - t;
        const x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x;
        const y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
        pts.push({ x: ox + x * sx, y: oy + y * sy });
      }
    }
    return pts;
  }
  if (shape.kind === 'ellipse') {
    for (let k = 0; k <= 64; k++) {
      const a = -Math.PI / 2 + (k / 64) * Math.PI * 2;
      pts.push({ x: ox + el.w / 2 + (el.w / 2) * Math.cos(a), y: oy + el.h / 2 + (el.h / 2) * Math.sin(a) });
    }
    return pts;
  }
  if (shape.kind === 'line') return [{ x: ox, y: oy + el.h / 2 }, { x: ox + el.w, y: oy + el.h / 2 }];
  return [{ x: ox, y: oy }, { x: ox + el.w, y: oy }, { x: ox + el.w, y: oy + el.h }, { x: ox, y: oy + el.h }, { x: ox, y: oy }];
}

/**
 * Makes an element travel along another shape's outline over its track — the butterfly on a curve, the
 * ring rolling along a line. Written as ordinary keyframes (up to 24, spaced by distance), so it scales
 * with the page like everything else. Its centre follows the path; with `turn` it also faces the way
 * it's going. Replaces the element's own (non-preset) keyframes.
 */
export function followPath(scene: DesignScene, id: string, pathId: string, turn: boolean, maxFrames = 24): DesignScene {
  const el = findElement(scene, id);
  const path = findElement(scene, pathId);
  if (!el || !path || el.id === path.id) return scene;
  const pts = outlineOf(scene, path);
  if (pts.length < 2) return scene;
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = lengths[lengths.length - 1];
  if (total <= 0) return scene;
  const parent = ancestors(scene, id).reduce((o, a) => ({ x: o.x + a.x, y: o.y + a.y }), { x: 0, y: 0 });
  const at = (d: number) => {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < d) i++;
    const seg = lengths[i] - lengths[i - 1] || 1;
    const u = Math.min(1, Math.max(0, (d - lengths[i - 1]) / seg));
    const a = pts[i - 1];
    const b = pts[i];
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  };
  const n = Math.max(2, Math.min(maxFrames, 24));
  const frames: DesignKeyframe[] = [];
  let lastAngle = 0;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const p = at(t * total);
    // Unwrapped, so a loop round a circle turns smoothly instead of spinning back at 180°.
    let angle = p.angle;
    if (k > 0) angle = lastAngle + ((((angle - lastAngle) % 360) + 540) % 360) - 180;
    lastAngle = angle;
    frames.push({
      preset: 'bar',
      t: round(t, 4),
      x: round(p.x - parent.x - el.w / 2, 1),
      y: round(p.y - parent.y - el.h / 2, 1),
      ...(turn ? { rotate: round(angle, 1) } : {}),
    });
  }
  return updateElement(scene, id, (e) => ({
    ...e,
    // The path replaces other motion; a way in or out stays on top at the ends.
    keyframes: [...e.keyframes.filter((k) => k.preset === 'enter' || k.preset === 'exit'), ...frames].sort((a, b) => a.t - b.t),
    track: e.track ?? { start: Math.max(0, Math.round(path.y - 700)), end: Math.round(path.y + path.h + 200) },
  }));
}

/** A small deterministic random source, so the same seed lays things out the same way every time. */
export function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

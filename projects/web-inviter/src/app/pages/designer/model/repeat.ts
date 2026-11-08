import type { DesignElement, DesignScene } from './scene';
import { cloneElement, findElement, flatten, groupElements, insertElement, moveWhole, removeElement, round, updateElement } from './scene-ops';

/**
 * Repeat: copies of one element laid out around a circle, in a grid or along a line, wrapped with the
 * original in a new group so the whole arrangement moves as one. The copies are ordinary copies (fresh
 * ids, same colours, motion and everything else), so after ungrouping each can be changed on its own.
 *
 * The group remembers how it was made (`recipe` `repeat:{…}`), so picking another layout while it is
 * selected lays the original out again instead of repeating the repeat.
 */
export type RepeatSpec =
  | { kind: 'circle'; count: number; radius: number; faceOut: boolean; startAngle: number }
  | { kind: 'grid'; columns: number; rows: number; gapX: number; gapY: number }
  | { kind: 'line'; count: number; spacing: number; angle: number };

/** The most copies one repeat makes (the original included). */
export const MAX_REPEAT = 120;

export const REPEAT_PREFIX = 'repeat:';

/** How far a radial repeat sits from its centre, by name: petals meet in the middle, a ring leaves a gap, a wide ring a big one. */
export type RingSpacing = 'petals' | 'ring' | 'wide';

/** The element's size on the page (its box times its scale). */
function shown(el: DesignElement): { w: number; h: number } {
  return { w: el.w * el.scale, h: el.h * el.scale };
}

/** The circle radius a named spacing gives this element with this many copies. */
export function ringRadius(el: DesignElement, count: number, spacing: RingSpacing): number {
  const { w, h } = shown(el);
  // A petal's base touches the centre: its centre is half its height out.
  const petals = h / 2;
  // Neighbours side by side round the ring with a little room between them.
  const ring = Math.max(petals, (count * w * 1.15) / (2 * Math.PI));
  const r = spacing === 'petals' ? petals : spacing === 'ring' ? ring : ring + h / 2;
  return round(r, 1);
}

/** A named spacing between copies in a grid or a line, in canvas units. */
export const GAPS = { none: 0, small: 12, wide: 32 } as const;
export type GapName = keyof typeof GAPS;

/** Named line directions, in degrees (0 is to the right, 90 down). */
export const DIRECTIONS = { across: 0, down: 90, diagonal: 45 } as const;
export type DirectionName = keyof typeof DIRECTIONS;

/** How many copies a spec makes, the original included. */
export function repeatCount(spec: RepeatSpec): number {
  return spec.kind === 'grid' ? spec.columns * spec.rows : spec.count;
}

/** A spec with its numbers inside what makes sense. */
export function clampSpec(spec: RepeatSpec): RepeatSpec {
  const int = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));
  const n = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
  switch (spec.kind) {
    case 'circle':
      return { kind: 'circle', count: int(spec.count, 2, 60), radius: n(spec.radius, 0, 2000), faceOut: !!spec.faceOut, startAngle: n(spec.startAngle, -360, 360) };
    case 'grid': {
      const columns = int(spec.columns, 1, 30);
      const rows = int(spec.rows, 1, Math.max(1, Math.floor(MAX_REPEAT / columns)));
      return { kind: 'grid', columns, rows, gapX: n(spec.gapX, -500, 500), gapY: n(spec.gapY, -500, 500) };
    }
    case 'line':
      return { kind: 'line', count: int(spec.count, 2, 60), spacing: n(spec.spacing, -500, 1000), angle: n(spec.angle, -360, 360) };
  }
}

/** Where each copy goes, relative to the original: a move of its centre and a turn, the original first (0, 0, 0). */
export function repeatPlaces(el: DesignElement, spec: RepeatSpec): { dx: number; dy: number; turn: number }[] {
  const { w, h } = shown(el);
  const out: { dx: number; dy: number; turn: number }[] = [];
  switch (spec.kind) {
    case 'circle': {
      // Angles are clockwise from the top. The original stays put, at the start angle on the ring.
      const s = (spec.startAngle * Math.PI) / 180;
      const cx = -spec.radius * Math.sin(s);
      const cy = spec.radius * Math.cos(s);
      for (let i = 0; i < spec.count; i++) {
        const step = (360 / spec.count) * i;
        const a = s + (step * Math.PI) / 180;
        out.push({ dx: cx + spec.radius * Math.sin(a), dy: cy - spec.radius * Math.cos(a), turn: spec.faceOut ? step : 0 });
      }
      break;
    }
    case 'grid':
      for (let r = 0; r < spec.rows; r++)
        for (let c = 0; c < spec.columns; c++) out.push({ dx: c * (w + spec.gapX), dy: r * (h + spec.gapY), turn: 0 });
      break;
    case 'line': {
      const a = (spec.angle * Math.PI) / 180;
      // One copy's length along the direction, plus the gap.
      const step = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)) + spec.spacing;
      for (let i = 0; i < spec.count; i++) out.push({ dx: i * step * Math.cos(a), dy: i * step * Math.sin(a), turn: 0 });
      break;
    }
  }
  return out.map((p) => ({ dx: round(p.dx, 1), dy: round(p.dy, 1), turn: round(p.turn, 2) }));
}

/** A copy of `el` moved by (dx, dy) and turned by `turn` degrees about its own centre, motion included. */
function placedCopy(el: DesignElement, dx: number, dy: number, turn: number): DesignElement {
  const moved = moveWhole(cloneElement(el, 0), dx, dy);
  const r1 = (v: number | null | undefined) => (v == null ? v : round(v, 1));
  return {
    ...moved,
    name: el.name ?? null,
    x: round(moved.x, 1),
    y: round(moved.y, 1),
    rotate: round(moved.rotate + turn, 2),
    keyframes: moved.keyframes.map((k) => ({
      ...k, x: r1(k.x), y: r1(k.y), ...(turn && k.rotate != null ? { rotate: round(k.rotate + turn, 2) } : {}),
    })),
  };
}

function groupName(spec: RepeatSpec): string {
  switch (spec.kind) {
    case 'circle': return `Ring of ${spec.count}`;
    case 'grid': return `Grid ${spec.columns} × ${spec.rows}`;
    case 'line': return `Row of ${spec.count}`;
  }
}

/** How a repeat group was made, read back from its recipe; null for anything else. */
export function repeatOf(el: DesignElement | null | undefined): RepeatSpec | null {
  const id = el?.recipe?.id;
  if (el?.type !== 'group' || !id?.startsWith(REPEAT_PREFIX) || !el.children?.length) return null;
  try {
    const spec = JSON.parse(id.slice(REPEAT_PREFIX.length)) as RepeatSpec;
    return spec && (spec.kind === 'circle' || spec.kind === 'grid' || spec.kind === 'line') ? clampSpec(spec) : null;
  } catch {
    return null;
  }
}

export type RepeatResult = { scene: DesignScene; groupId: string } | { error: string };

/**
 * Repeats an element. The original and its copies end up in one new group where the original was, in
 * the original's place among its neighbours. When `id` is a repeat group, its first piece (the original)
 * is laid out again, and the group keeps its name, motion and everything else.
 */
export function repeatElement(scene: DesignScene, id: string, raw: RepeatSpec, maxElements = Infinity): RepeatResult {
  const spec = clampSpec(raw);
  const target = findElement(scene, id);
  if (!target) return { error: 'There is nothing selected to repeat.' };
  const again = repeatOf(target) ? target : null;
  const original = again ? moveWhole(again.children![0], again.x, again.y) : target;
  const places = repeatPlaces(original, spec);
  if (places.length > MAX_REPEAT) return { error: `That would make ${places.length} copies; ${MAX_REPEAT} is the most one repeat makes.` };
  if (places.length < 2) return { error: 'Repeat needs at least two.' };

  const pieces = 1 + countAll(original);
  const existing = flatten(scene).length - (again ? countAll(again) : 0);
  if (existing + (places.length - 1) * pieces + 1 > maxElements)
    return { error: `That would take the design past its ${maxElements} elements. Try fewer copies.` };

  // Work on the original where it sits: in the old repeat group's place, or its own.
  const flat = flatten(scene).find((f) => f.element.id === id)!;
  let next = scene;
  if (again) {
    next = removeElement(next, id);
    next = insertElement(next, original, flat.parentId, flat.index);
  }
  const copies = places.slice(1).map((p) => placedCopy(original, p.dx, p.dy, p.turn));
  copies.forEach((c, i) => (next = insertElement(next, c, flat.parentId, flat.index + 1 + i)));
  const grouped = groupElements(next, [original.id, ...copies.map((c) => c.id)]);
  if (!grouped.groupId) return { error: 'Those copies could not be grouped.' };
  next = updateElement(grouped.scene, grouped.groupId, (g) => {
    const recipe = { id: REPEAT_PREFIX + JSON.stringify(spec), seed: 0 };
    if (!again) return { ...g, name: groupName(spec), recipe };
    // Laid out again: the group keeps what was set on it, its motion moved with its new corner.
    const dx = g.x - again.x;
    const dy = g.y - again.y;
    const moved = moveWhole(again, dx, dy);
    return {
      ...moved, x: g.x, y: g.y, w: g.w, h: g.h, children: g.children, recipe,
      name: again.name && again.name !== groupName(repeatOf(again)!) ? again.name : groupName(spec),
    };
  });
  next = updateElement(next, grouped.groupId, fitToPieces);
  // groupElements made a new group; laying out again keeps the old id, so selections and references hold.
  if (again) {
    const groupId = grouped.groupId;
    next = updateElement(next, groupId, (g) => ({ ...g, id: again.id }));
    return { scene: next, groupId: again.id };
  }
  return { scene: next, groupId: grouped.groupId };
}

/**
 * A group's box round what its pieces show, turned ones included (a ring of petals reaches past their
 * unturned boxes), so its handles and its hit area cover the whole arrangement.
 */
function fitToPieces(group: DesignElement): DesignElement {
  const kids = group.children ?? [];
  if (!kids.length) return group;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of kids) {
    const a = (c.rotate * Math.PI) / 180;
    const hw = (c.w * c.scale) / 2;
    const hh = (c.h * c.scale) / 2;
    const ex = Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a));
    const ey = Math.abs(hw * Math.sin(a)) + Math.abs(hh * Math.cos(a));
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    x0 = Math.min(x0, cx - ex); y0 = Math.min(y0, cy - ey); x1 = Math.max(x1, cx + ex); y1 = Math.max(y1, cy + ey);
  }
  const dx = round(x0, 1);
  const dy = round(y0, 1);
  const moved = moveWhole(group, dx, dy);
  return {
    ...moved, x: round(moved.x, 1), y: round(moved.y, 1), w: round(x1 - dx, 1), h: round(y1 - dy, 1),
    children: kids.map((c) => {
      const k = moveWhole(c, -dx, -dy);
      return { ...k, x: round(k.x, 1), y: round(k.y, 1), keyframes: k.keyframes.map((f) => ({ ...f, ...(f.x != null ? { x: round(f.x, 1) } : {}), ...(f.y != null ? { y: round(f.y, 1) } : {}) })) };
    }),
  };
}

function countAll(el: DesignElement): number {
  return (el.children ?? []).reduce((n, c) => n + 1 + countAll(c), 0);
}

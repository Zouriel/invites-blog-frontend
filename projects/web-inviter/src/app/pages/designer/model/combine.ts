import { mapContours, type UiPathContour, type UiPathItem, type UiPathOp } from '@zouriel/ui/canvas';
import type { DesignElement, DesignScene } from './scene';
import { flatten, removeElement, round, updateElement, type FlatElement } from './scene-ops';
import { itemsToPath, shapeToContours } from './shape-paths';

/**
 * Combine shapes: two or more shapes made into one drawn shape, the way the shape editor merges its
 * pieces (Photoshop's Combine, Subtract, Intersect and Exclude). Each shape is turned into outlines as the
 * shape editor does when it opens one (boxes, ovals and polygons become paths), placed where it shows on
 * the page (size, scale and rotation baked in), and the pieces are merged bottom to top. The bottom-most
 * shape is kept and becomes the result, so its colours, outline, pattern, effects, motion and name carry
 * over; the others are removed.
 */
export type CombineOp = UiPathOp;

export const COMBINE_OPS: { op: CombineOp; label: string; hint: string }[] = [
  { op: 'add', label: 'Add', hint: 'One shape covering all of them.' },
  { op: 'cut', label: 'Cut out', hint: 'The bottom shape with the others cut out of it.' },
  { op: 'intersect', label: 'Overlap', hint: 'Only where they all overlap.' },
  { op: 'exclude', label: 'Exclude', hint: 'Everything but where they overlap.' },
];

/** The selected shapes in paint order, bottom first, or why they can't be combined. */
export function combinable(scene: DesignScene, ids: readonly string[]): { shapes: FlatElement[] } | { error: string } {
  const set = new Set(ids);
  const flat = flatten(scene).filter((f) => set.has(f.element.id));
  if (flat.length < 2) return { error: 'Select two or more shapes to combine them.' };
  if (flat.some((f) => f.element.type !== 'shape' || !f.element.shape))
    return { error: 'Only shapes can be combined: text, pictures and groups can’t.' };
  if (flat.some((f) => f.element.shape!.kind === 'line'))
    return { error: 'Lines have no area to combine. Use boxes, ovals, polygons or drawn shapes.' };
  if (flat.some((f) => f.parentId !== flat[0].parentId))
    return { error: 'Shapes in different groups can’t be combined. Move them into the same group first.' };
  return { shapes: flat };
}

/** A shape's outline where it shows inside its parent: its box scaled and turned about its centre. */
export function placedContours(el: DesignElement): UiPathContour[] {
  const cx = el.w / 2;
  const cy = el.h / 2;
  const a = (el.rotate * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const s = el.scale;
  return mapContours(shapeToContours(el), (p) => {
    const x = (p.x - cx) * s;
    const y = (p.y - cy) * s;
    return { x: el.x + cx + x * cos - y * sin, y: el.y + cy + x * sin + y * cos };
  });
}

export function combineShapes(scene: DesignScene, ids: readonly string[], op: CombineOp): { scene: DesignScene; id: string } | { error: string } {
  const check = combinable(scene, ids);
  if ('error' in check) return check;
  const [bottom, ...rest] = check.shapes.map((f) => f.element);
  const items: UiPathItem[] = [
    { id: bottom.id, contours: placedContours(bottom), op: 'add' },
    ...rest.map((el) => ({ id: el.id, contours: placedContours(el), op })),
  ];
  const result = itemsToPath(items, { merge: true });
  if (!result || !result.path.contours.some((c) => c.closed && c.points.length >= 2))
    return { error: op === 'intersect' ? 'They don’t all overlap, so nothing would be left.' : 'Nothing would be left of them.' };
  const { path, box } = result;
  const dx = box.x - bottom.x;
  const dy = box.y - bottom.y;
  const turned = bottom.rotate;
  const scaled = bottom.scale || 1;
  const combined: DesignElement = {
    ...bottom,
    name: bottom.name ?? 'Combined shape',
    x: round(box.x, 1), y: round(box.y, 1), w: round(box.w, 1), h: round(box.h, 1), rotate: 0, scale: 1,
    // Its motion stays relative to where it was: places move with the new box; turns and sizes are now in the outline.
    keyframes: bottom.keyframes.map((k) => ({
      ...k,
      ...(k.x != null ? { x: round(k.x + dx, 1) } : {}),
      ...(k.y != null ? { y: round(k.y + dy, 1) } : {}),
      ...(k.rotate != null ? { rotate: round(k.rotate - turned, 2) } : {}),
      ...(k.scale != null ? { scale: round(k.scale / scaled, 3) } : {}),
    })),
    shape: { ...bottom.shape!, kind: 'path', path, radius: 0 },
  };
  let next = updateElement(scene, bottom.id, () => combined);
  for (const el of rest) next = removeElement(next, el.id);
  return { scene: next, id: bottom.id };
}

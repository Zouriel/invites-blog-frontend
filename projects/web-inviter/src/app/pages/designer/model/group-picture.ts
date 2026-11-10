import type { DesignElement, DesignKeyframe, DesignScene } from './scene';
import { labelOf, newId } from './scene-ops';
import { isMaskKind } from '../render/shapes';

/**
 * Turning a group into one picture (Flatten): what it bakes, what it keeps, and when it can't.
 *
 * <p>The picture is the group's contents drawn by the real page renderer (render/rasterize.ts) at rest.
 * Everything the group does as a whole stays on the picture element and works the same there: its place,
 * motion, loop, bar, pin, opacity, blend, mask, clip, pivot and effects (shadow, glows, bevel, pattern,
 * light), because the compiler applies each of those to an element's box whatever its type. Only what
 * is inside is baked, so it is refused when something inside would look different as a still picture:
 * anything that moves on its own, fills in from the event, is tapped, or mixes with what is under the
 * group.</p>
 */

/** Why a group can't become a picture without changing how it looks or works; empty when it can. */
export function flattenBlockers(scene: DesignScene, group: DesignElement): string[] {
  if (group.type !== 'group') return ['Only a group can be turned into a picture.'];
  if (!group.children?.length) return ['The group is empty.'];
  const out: string[] = [];
  const say = (el: DesignElement, why: string) => {
    if (out.length < 4) out.push(`${labelOf(el)} ${why}`);
  };
  const visit = (el: DesignElement) => {
    switch (el.type) {
      case 'slot': say(el, 'is a photo the host adds.'); break;
      case 'rsvp': case 'link': say(el, 'is a button guests tap.'); break;
      case 'dress': say(el, 'shows the event\'s own colours.'); break;
      case 'countdown': say(el, 'counts down live.'); break;
      case 'text': if (el.text?.runs.some((r) => !!r.var)) say(el, 'shows a field filled in for each event.'); break;
      case 'shape': if (el.shape?.particles) say(el, 'has moving particles.'); break;
    }
    if (moves(el)) say(el, 'moves on its own.');
    else if (el.pinned) say(el, 'is pinned while the page scrolls.');
    else if (scene.stage && el.track) say(el, 'shows for only part of the page.');
    if (el.blend && el.blend !== 'normal') say(el, 'blends with what is under the group.');
    if (el.tapScroll != null) say(el, 'scrolls the page when tapped.');
    if (el.roleScope) say(el, 'shows to some guests only.');
    if (el.block) say(el, 'belongs to a part of the page some events leave out.');
    el.children?.forEach(visit);
  };
  group.children.forEach(visit);
  return out;
}

/** Whether its keyframes or loop change anything over the scroll (one keyframe, or all the same, is still). */
export function moves(el: DesignElement): boolean {
  if (el.loop?.frames.length) return true;
  const frames = [...el.keyframes].filter((k) => Number.isFinite(k.t)).sort((a, b) => a.t - b.t);
  if (frames.length < 2) return false;
  const held: Record<string, unknown> = {};
  let first: string | null = null;
  for (const k of frames) {
    for (const [key, v] of Object.entries(k) as [keyof DesignKeyframe, unknown][]) {
      if (key === 't' || key === 'easing' || key === 'preset' || v == null) continue;
      held[key] = v;
    }
    const now = JSON.stringify(Object.keys(held).sort().map((key) => [key, held[key]]));
    if (first === null) first = now;
    else if (now !== first) return true;
  }
  return false;
}

/** A box in the group's own units (0,0 is its top left). */
export interface Box { x: number; y: number; w: number; h: number }

/** Whether the group cuts off what is outside its box (a mask or a clip), so nothing past it shows. */
export function clipsToBox(group: DesignElement): boolean {
  // Only a mask the page draws: an unknown kind is ignored there, so it cuts nothing.
  return (!!group.mask && isMaskKind(group.mask.kind)) || group.clipShape === 'inset' || group.clipShape === 'circle';
}

/**
 * The group drawn alone and still, at (dx, dy) on a page with nothing else: its contents only. What the
 * picture element keeps (motion, opacity, blend, mask, clip, effects) is left off here so it isn't
 * applied twice; a child's still keyframe is folded into the child, since a still picture has no scroll.
 */
export function renderScene(scene: DesignScene, group: DesignElement, dx: number, dy: number): DesignScene {
  const settle = (el: DesignElement): DesignElement => {
    const k = el.keyframes.length ? held(el.keyframes) : null;
    return {
      ...el,
      ...(k ? {
        x: k.x ?? el.x, y: k.y ?? el.y, rotate: k.rotate ?? el.rotate, scale: k.scale ?? el.scale, opacity: k.opacity ?? el.opacity,
        // What a still keyframe holds besides place, kept as one keyframe the renderer plays at its first moment.
        keyframes: hasExtras(k) ? [{ ...k, t: 0 }] : [],
      } : {}),
      track: null, pinned: false, enter: null, exit: null, loop: null,
      children: el.children?.map(settle) ?? el.children,
    };
  };
  const still: DesignElement = {
    ...group,
    x: dx, y: dy, rotate: 0, scale: 1, opacity: 1, keyframes: [], track: null, pinned: false, scrolls: false, enter: null, exit: null, loop: null,
    blend: null, mask: null, clipShape: null, origin: null, backfaceHidden: false, tapScroll: null, block: null, roleScope: null,
    pattern: null, bevel: null, innerGlow: null, outerGlow: null, shadow: null, light: null, gradient: null,
    children: group.children?.map(settle) ?? [],
  };
  // The page's own size is set by the rasterizer; only the group is on it.
  return { ...scene, stage: false, length: null, elements: [still] };
}

/** A still element's keyframe values, carried forward (all frames are the same, see `moves`). */
function held(frames: DesignKeyframe[]): DesignKeyframe {
  const out: DesignKeyframe = { t: 0 };
  for (const k of [...frames].sort((a, b) => a.t - b.t))
    for (const [key, v] of Object.entries(k)) if (v != null && key !== 't' && key !== 'easing' && key !== 'preset') (out as unknown as Record<string, unknown>)[key] = v;
  return out;
}

function hasExtras(k: DesignKeyframe): boolean {
  return [k.rotateX, k.rotateY, k.skewX, k.skewY, k.blur, k.clip, k.draw, k.tracking, k.lift].some((v) => v != null);
}

/**
 * The picture element that takes the group's place: the same id-less settings for how it sits and moves,
 * in `box` (the group's box, grown to take in what spills past it). Growing the box moves its top left,
 * so its place and every keyframe's move with it, and its pivot is set to the same point on the page.
 */
export function pictureElement(group: DesignElement, assetId: string, box: Box): DesignElement {
  const { x: dx, y: dy, w, h } = box;
  const grown = Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6 || Math.abs(w - group.w) > 1e-6 || Math.abs(h - group.h) > 1e-6;
  const ox = group.origin?.x ?? 0.5, oy = group.origin?.y ?? 0.5;
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const shift = (k: DesignKeyframe): DesignKeyframe => ({ ...k, ...(k.x != null ? { x: round1(k.x + dx) } : {}), ...(k.y != null ? { y: round1(k.y + dy) } : {}) });
  const { children: _children, recipe: _recipe, ...rest } = group;
  return {
    ...rest,
    id: newId(),
    type: 'image',
    name: group.name ?? null,
    x: round1(group.x + dx), y: round1(group.y + dy), w, h,
    keyframes: grown ? group.keyframes.map(shift) : group.keyframes,
    origin: grown ? { x: r6((ox * group.w - dx) / w), y: r6((oy * group.h - dy) / h) } : group.origin ?? null,
    // A group's gradient isn't drawn (only text, shapes, buttons, illustrations and pictures take one).
    gradient: null,
    image: { asset: assetId, fit: 'stretch', radius: 0 },
    children: null,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

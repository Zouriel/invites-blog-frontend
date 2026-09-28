import type { DesignElement, DesignKeyframe, DesignScene, DesignTrack, MotionPreset } from './scene';
import { findElement, round, trackOf, updateElement } from './scene-ops';

/** The values an effect move changes, from where it starts to where it ends. */
interface EffectValues {
  rotateX?: number;
  rotateY?: number;
  skewX?: number;
  blur?: number;
  clip?: number[];
  draw?: number;
  tracking?: number;
  opacity?: number;
}

/**
 * A ready-made effect in plain words — "Open like a door", "Come into focus" — so nobody has to know
 * what 85° about the vertical axis means. Picking one writes two ordinary keyframes (where it starts, at
 * the playhead; where it ends, a pace further on) and sets whatever it needs: the pivot a door hinges
 * on, the clip shape a reveal cuts with. The keyframes show on the timeline like any others and can be
 * dragged or fine-tuned afterwards.
 */
export interface EffectMove {
  id: string;
  label: string;
  group: string;
  from: EffectValues;
  to: EffectValues;
  easing?: string;
  origin?: { x: number; y: number };
  clipShape?: 'inset' | 'circle';
  backfaceHidden?: boolean;
  /** Only on this kind of element. */
  only?: 'shape' | 'text';
}

const SMOOTH = 'ease-in-out';

export const EFFECT_MOVES: EffectMove[] = [
  // Turn in 3D
  { id: 'coin', label: 'Spin like a coin', group: 'Turn in 3D', from: { rotateY: 0 }, to: { rotateY: 360 }, easing: SMOOTH },
  { id: 'flip-over', label: 'Flip over', group: 'Turn in 3D', from: { rotateY: 0 }, to: { rotateY: 180 }, easing: SMOOTH },
  { id: 'flip-in', label: 'Flip into view', group: 'Turn in 3D', from: { rotateY: 90, opacity: 0 }, to: { rotateY: 0, opacity: 1 }, easing: 'ease-out' },
  { id: 'fold-open', label: 'Fold open like a flap', group: 'Turn in 3D', from: { rotateX: 0 }, to: { rotateX: 180 }, easing: SMOOTH, origin: { x: 0.5, y: 0 } },
  { id: 'fold-shut', label: 'Fold shut', group: 'Turn in 3D', from: { rotateX: 180 }, to: { rotateX: 0 }, easing: SMOOTH, origin: { x: 0.5, y: 0 } },
  { id: 'door-open', label: 'Open like a door', group: 'Turn in 3D', from: { rotateY: 0 }, to: { rotateY: -85 }, easing: SMOOTH, origin: { x: 0, y: 0.5 } },
  { id: 'door-close', label: 'Close like a door', group: 'Turn in 3D', from: { rotateY: -85 }, to: { rotateY: 0 }, easing: SMOOTH, origin: { x: 0, y: 0.5 } },
  { id: 'tip-back', label: 'Tip back', group: 'Turn in 3D', from: { rotateX: 0 }, to: { rotateX: 60 }, easing: SMOOTH, origin: { x: 0.5, y: 1 } },
  { id: 'stand-up', label: 'Stand up', group: 'Turn in 3D', from: { rotateX: 80, opacity: 0 }, to: { rotateX: 0, opacity: 1 }, easing: 'ease-out', origin: { x: 0.5, y: 1 } },
  // Focus
  { id: 'focus-in', label: 'Come into focus', group: 'Focus', from: { blur: 12, opacity: 0.4 }, to: { blur: 0, opacity: 1 }, easing: 'ease-out' },
  { id: 'focus-out', label: 'Go out of focus', group: 'Focus', from: { blur: 0, opacity: 1 }, to: { blur: 12, opacity: 0.4 }, easing: 'ease-in' },
  // Reveal
  { id: 'reveal-right', label: 'Reveal left to right', group: 'Reveal', from: { clip: [0, 100, 0, 0] }, to: { clip: [0, 0, 0, 0] }, easing: 'ease-out', clipShape: 'inset' },
  { id: 'reveal-down', label: 'Reveal top down', group: 'Reveal', from: { clip: [0, 0, 100, 0] }, to: { clip: [0, 0, 0, 0] }, easing: 'ease-out', clipShape: 'inset' },
  { id: 'reveal-up', label: 'Reveal bottom up', group: 'Reveal', from: { clip: [100, 0, 0, 0] }, to: { clip: [0, 0, 0, 0] }, easing: 'ease-out', clipShape: 'inset' },
  { id: 'iris-open', label: 'Open like an iris', group: 'Reveal', from: { clip: [0] }, to: { clip: [71] }, easing: 'ease-out', clipShape: 'circle' },
  { id: 'wipe-away', label: 'Wipe away', group: 'Reveal', from: { clip: [0, 0, 0, 0] }, to: { clip: [0, 0, 0, 100] }, easing: 'ease-in', clipShape: 'inset' },
  { id: 'iris-close', label: 'Close like an iris', group: 'Reveal', from: { clip: [71] }, to: { clip: [0] }, easing: 'ease-in', clipShape: 'circle' },
  // Lean
  { id: 'lean', label: 'Lean forward', group: 'Lean', from: { skewX: 0 }, to: { skewX: -15 }, easing: SMOOTH },
  { id: 'straighten', label: 'Straighten up', group: 'Lean', from: { skewX: -15 }, to: { skewX: 0 }, easing: SMOOTH },
  // Outlines and letters
  { id: 'draw', label: 'Draw its outline', group: 'Outline', from: { draw: 0 }, to: { draw: 1 }, easing: SMOOTH, only: 'shape' },
  { id: 'erase', label: 'Erase its outline', group: 'Outline', from: { draw: 1 }, to: { draw: 0 }, easing: SMOOTH, only: 'shape' },
  { id: 'letters-close', label: 'Letters close in', group: 'Letters', from: { tracking: 0.5, opacity: 0 }, to: { tracking: 0, opacity: 1 }, easing: 'ease-out', only: 'text' },
  { id: 'letters-spread', label: 'Letters spread out', group: 'Letters', from: { tracking: 0 }, to: { tracking: 0.5 }, easing: 'ease-in', only: 'text' },
];

/** How much scrolling a move takes, in plain words. */
export const PACES = [
  { value: 'quick', label: 'Quick', units: 180 },
  { value: 'steady', label: 'Steady', units: 360 },
  { value: 'slow', label: 'Slow', units: 720 },
] as const;
export type Pace = (typeof PACES)[number]['value'];

/** The move as a preset, so the same moving thumbnail draws it. */
export function asPreview(move: EffectMove): MotionPreset {
  const frame = (t: number, v: EffectValues) => ({ t, dx: 0, dy: 0, dRotate: 0, scale: 1, ...v, opacity: v.opacity ?? 1, easing: t === 0 ? move.easing ?? null : null });
  return {
    id: move.id, label: move.label, frames: [frame(0, move.from), frame(1, move.to)],
    origin: move.origin ? [move.origin.x, move.origin.y] : null, clipShape: move.clipShape ?? null, only: move.only ?? null,
  };
}

/**
 * Plays a move from `from` (a scroll position, the playhead) for `units` of scroll. Writes a keyframe at
 * each end — merged into one already there — and stretches the element's bar to hold it. An element
 * without a bar gets one from the top of the page, so on a stage (where a bar is a clip) it doesn't
 * start vanishing before the effect.
 */
export function applyMove(scene: DesignScene, id: string, move: EffectMove, from: number, units: number): DesignScene {
  const el = findElement(scene, id);
  if (!el) return scene;
  const start = Math.max(0, Math.round(from));
  const end = start + Math.max(40, Math.round(units));
  // What its keyframes are measured against now: its bar, or the whole page for something without one.
  const existing: DesignTrack = trackOf(scene, el);
  const track = { start: Math.min(Math.round(existing.start), start), end: Math.max(Math.round(existing.end), end) };
  const span = Math.max(1, track.end - track.start);
  // Keyframes keep their scroll positions when the bar they're measured against is stretched.
  const rescale = (k: DesignKeyframe): DesignKeyframe => {
    const at = existing.start + k.t * (existing.end - existing.start);
    return { ...k, t: round((at - track.start) / span, 4) };
  };
  let keyframes = el.keyframes.map(rescale);
  const t0 = round((start - track.start) / span, 4);
  const t1 = round((end - track.start) / span, 4);
  const put = (t: number, values: EffectValues, easing?: string | null) => {
    const i = keyframes.findIndex((k) => Math.abs(k.t - t) < 0.002);
    const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as EffectValues;
    if (i >= 0) keyframes[i] = { ...keyframes[i], ...clean, ...(easing !== undefined ? { easing } : {}) };
    else keyframes.push({ t, ...clean, ...(easing ? { easing } : {}) });
  };
  // Other clip values meant another shape: they'd mean nothing now.
  if (move.clipShape && el.clipShape && el.clipShape !== move.clipShape) keyframes = keyframes.map((k) => ({ ...k, clip: null }));
  put(t0, move.from, move.easing ?? null);
  put(t1, move.to);
  keyframes.sort((a, b) => a.t - b.t);
  return updateElement(scene, id, (e) => ({
    ...e,
    track,
    keyframes,
    ...(move.origin ? { origin: move.origin } : {}),
    ...(move.clipShape ? { clipShape: move.clipShape } : {}),
    ...(move.backfaceHidden !== undefined ? { backfaceHidden: move.backfaceHidden } : {}),
  }));
}

/** The moves that mean something on an element. */
export function movesFor(el: DesignElement | null): EffectMove[] {
  return EFFECT_MOVES.filter((m) => !m.only || m.only === el?.type);
}

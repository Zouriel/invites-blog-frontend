import { REFERENCE_VIEWPORT, type DesignElement, type DesignKeyframe, type DesignScene, type DesignTrack, type MotionPreset } from './scene';
import { applyPreset, round, scrollRange, trackOf } from './scene-ops';

/**
 * Keyframes are stored as a fraction of their element's bar (what the compiler reads), but they mean a
 * place in the scroll. These keep that meaning when the bar changes, and say in words what each
 * keyframe does.
 *
 * <p>What rides what when a bar is trimmed:</p>
 * <ul>
 *   <li>a way in (`preset: 'enter'`) keeps its length and stays at the bar's start;</li>
 *   <li>a way out (`preset: 'exit'`) keeps its length and stays at the bar's end;</li>
 *   <li>motion across the whole bar (`preset: 'bar'`: slow zoom, parallax, a path, imported
 *       animation, sticker choreography) stretches with it — that's how it's slowed down;</li>
 *   <li>everything else stays where it was put in the scroll, and the bar can't be trimmed past it.</li>
 * </ul>
 */

/** Stored t precision: the compiler writes percentages to three places, so five places of t. */
export const T_DIGITS = 5;

/** Where a keyframe is in the scroll. */
export function keyframeScroll(track: DesignTrack, t: number): number {
  return track.start + t * (track.end - track.start);
}

/** The stored t for a scroll position on a bar. */
export function tOn(track: DesignTrack, scroll: number): number {
  const span = Math.max(1, track.end - track.start);
  return round(Math.min(1, Math.max(0, (scroll - track.start) / span)), T_DIGITS);
}

export interface Retimed {
  element: DesignElement;
  /** The bar that was asked for, when a keyframe in the way made it stop short. */
  blockedAt: number | null;
}

/**
 * A new bar for an element with every keyframe where it belongs (see above). The bar stops short of
 * any free keyframe it would cut off, and a way in and a way out that no longer fit side by side are
 * shortened together.
 */
export function retimeTrack(scene: DesignScene, el: DesignElement, wanted: DesignTrack): Retimed {
  const old = trackOf(scene, el);
  const at = el.keyframes.map((k) => keyframeScroll(old, k.t));
  const free = el.keyframes.map((k, i) => (!k.preset ? at[i] : null)).filter((v): v is number => v !== null);
  let start = Math.round(wanted.start);
  let end = Math.round(wanted.end);
  let blockedAt: number | null = null;
  if (free.length) {
    const first = Math.floor(Math.min(...free));
    const last = Math.ceil(Math.max(...free));
    if (start > first) { blockedAt = start; start = first; }
    if (end < last) { blockedAt = end; end = last; }
  }
  start = Math.max(0, start);
  end = Math.max(start + 1, end);
  const span = end - start;

  // How long the way in and way out last, from their ends of the bar.
  const inLength = Math.max(0, ...el.keyframes.map((k, i) => (k.preset === 'enter' ? at[i] - old.start : 0)));
  const outLength = Math.max(0, ...el.keyframes.map((k, i) => (k.preset === 'exit' ? old.end - at[i] : 0)));
  const squeeze = inLength + outLength > span ? span / (inLength + outLength) : 1;

  const keyframes = el.keyframes.map((k, i): DesignKeyframe => {
    let place: number;
    if (k.preset === 'bar') return k;
    if (k.preset === 'enter') place = start + (at[i] - old.start) * squeeze;
    else if (k.preset === 'exit') place = end - (old.end - at[i]) * squeeze;
    else place = at[i];
    return { ...k, t: tOn({ start, end }, place) };
  });
  keyframes.sort((a, b) => a.t - b.t);
  return { element: { ...el, track: { start, end }, keyframes }, blockedAt };
}

/** Moves the whole bar, motion and all: nothing changes but where it happens. */
export function shiftTrack(el: DesignElement, track: DesignTrack): DesignElement {
  return { ...el, track: { start: Math.max(0, Math.round(track.start)), end: Math.round(track.end) } };
}

type Value = number | string | null;
const PROPS: { key: keyof DesignKeyframe; word: string }[] = [
  { key: 'opacity', word: 'fade' }, { key: 'x', word: 'move' }, { key: 'y', word: 'move' }, { key: 'rotate', word: 'turn' },
  { key: 'scale', word: 'size' }, { key: 'rotateX', word: '3D turn' }, { key: 'rotateY', word: '3D turn' }, { key: 'skewX', word: 'slant' },
  { key: 'skewY', word: 'slant' }, { key: 'blur', word: 'blur' }, { key: 'clip', word: 'reveal' }, { key: 'draw', word: 'outline' },
  { key: 'tracking', word: 'letter spacing' }, { key: 'lift', word: 'in front' },
];

export interface KeyframeNote {
  /** Where it is in the scroll, in whole units. */
  at: number;
  /** What it marks, in words: "Fade in starts", "Blur, fade", "Holds until here". */
  label: string;
}

/**
 * What each keyframe marks. A preset's keyframes say which preset and whether it starts or ends there;
 * others say what changes between the previous keyframe and this one.
 */
export function keyframeNotes(scene: DesignScene, el: DesignElement, presetName: (slot: 'enter' | 'exit', id: string) => string | null): KeyframeNote[] {
  const track = trackOf(scene, el);
  const order = el.keyframes.map((k, i) => ({ k, i })).sort((a, b) => a.k.t - b.k.t);
  const state = new Map<string, Value>();
  const base: Record<string, Value> = { opacity: el.opacity, x: el.x, y: el.y, rotate: el.rotate, scale: el.scale, rotateX: 0, rotateY: 0, skewX: 0, skewY: 0, blur: 0, clip: null, draw: 1, tracking: 0, lift: 0 };
  for (const [key, v] of Object.entries(base)) state.set(key, v);
  const notes: KeyframeNote[] = new Array(el.keyframes.length);
  order.forEach(({ k, i }, n) => {
    const changed = new Set<string>();
    for (const { key, word } of PROPS) {
      const raw = k[key] as number | number[] | null | undefined;
      if (raw == null) continue;
      const value: Value = Array.isArray(raw) ? raw.join(',') : raw;
      if (state.get(key) !== value && n > 0) changed.add(word);
      state.set(key, value);
    }
    const at = Math.round(keyframeScroll(track, k.t));
    let label: string;
    if (k.preset === 'enter' || k.preset === 'exit') {
      const tagged = order.filter((o) => o.k.preset === k.preset);
      const name = presetName(k.preset, (k.preset === 'enter' ? el.enter : el.exit) ?? '') ?? (k.preset === 'enter' ? 'Way in' : 'Way out');
      const where = tagged[0].i === i ? 'starts' : tagged[tagged.length - 1].i === i ? 'ends' : 'continues';
      const way = /\b(in|out|away|off)\b/i.test(name) ? '' : k.preset === 'enter' ? ' in' : ' out';
      label = `${name}${way} ${where}`;
    } else if (k.preset === 'bar') {
      label = n === 0 || order[n - 1].k.preset !== 'bar' ? 'Motion across the bar starts' : order.slice(n + 1).some((o) => o.k.preset === 'bar') ? 'Motion across the bar' : 'Motion across the bar ends';
    } else if (n === 0) {
      label = order.length === 1 ? 'Holds these values' : 'Starts here';
    } else {
      // Nothing changes since the one before: it marks where a hold ends.
      label = changed.size ? cap([...changed].join(', ')) : 'Holds until here';
    }
    notes[i] = { at, label };
  });
  return notes;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The longest a way in or out takes when put on a bar that's already there, so it arrives in a flick of the thumb. */
export const PRESET_REACH = 260;

/**
 * A preset put on an element, as the editor does it: its keyframes, and a bar for them.
 *
 * <ul>
 *   <li>On a bar that's already there (a clip), a way in plays at its start and a way out at its end,
 *       squeezed to at most `PRESET_REACH` so a long bar doesn't make it crawl.</li>
 *   <li>On a stage, something with no bar is there the whole time, so the preset happens at the
 *       playhead: a way in makes it arrive there (it isn't there before), a way out makes it leave
 *       there (it was there all along, and is gone after).</li>
 *   <li>On a scrolling page, something with no bar gets one from when it comes up the screen.</li>
 * </ul>
 */
export function withPreset(
  scene: DesignScene, el: DesignElement, preset: MotionPreset | null, slot: 'enter' | 'exit', list: MotionPreset[], playhead: number,
): DesignElement {
  let next = applyPreset(el, preset, slot);
  // Leaving a split preset for one that isn't: the text goes back to moving as one block.
  const before = list.find((p) => p.id === (slot === 'enter' ? el.enter : el.exit));
  if (before?.split && !preset?.split && next.text) next = { ...next, text: { ...next.text, split: null } };
  if (!preset) return next;
  if (el.track) return { ...next, keyframes: snappy(next.keyframes, slot, el.track.end - el.track.start) };
  const range = scrollRange(scene);
  if (scene.stage) {
    const at = Math.max(0, Math.round(playhead));
    const track = slot === 'enter' ? { start: at, end: Math.max(range, at + 900) } : { start: 0, end: at + PRESET_REACH };
    return { ...next, track, keyframes: atPlayhead(next.keyframes, slot, trackOf(scene, el), track, at) };
  }
  // A preset needs a track to play over: start it as the element comes up the screen.
  // Early enough to finish entering before its bottom meets the bottom of the screen, where the page may end.
  const start = Math.round(Math.max(0, Math.min(range, el.y - REFERENCE_VIEWPORT * 0.9, el.y + el.h - REFERENCE_VIEWPORT - 180)));
  // Ending while half of it is still on screen, so an exit is seen. The page runs on to a track's
  // end, so an entrance alone doesn't lengthen it more than it must.
  let end = Math.min(Math.max(el.y + el.h / 2, start + 240), start + 1200);
  if (slot === 'enter') end = Math.min(end, Math.max(range, start + 240));
  return { ...next, track: { start, end: Math.round(end) } };
}

/**
 * A preset's keyframes laid out from the playhead on a new bar: the way in from `at` over up to
 * `PRESET_REACH`, the way out from `at` to the bar's end. Other keyframes keep their places in the scroll.
 */
function atPlayhead(keyframes: DesignKeyframe[], slot: 'enter' | 'exit', old: DesignTrack, track: DesignTrack, at: number): DesignKeyframe[] {
  const tagged = keyframes.filter((k) => k.preset === slot);
  const lo = Math.min(...tagged.map((k) => k.t));
  const hi = Math.max(...tagged.map((k) => k.t));
  const length = slot === 'enter' ? Math.min(PRESET_REACH, (hi - lo) * (track.end - track.start)) : track.end - at;
  return keyframes
    .map((k) => {
      if (k.preset !== slot) return { ...k, t: tOn(track, keyframeScroll(old, k.t)) };
      const f = hi > lo ? (k.t - lo) / (hi - lo) : 0;
      return { ...k, t: tOn(track, at + f * length) };
    })
    .sort((a, b) => a.t - b.t);
}

/**
 * A preset's keyframes squeezed to at most `PRESET_REACH` units of scroll at their end of a long bar,
 * so an entrance on a bar that runs to the end of the page still arrives in a flick of the thumb.
 */
export function snappy(keyframes: DesignKeyframe[], slot: 'enter' | 'exit', length: number): DesignKeyframe[] {
  const tagged = keyframes.filter((k) => k.preset === slot);
  if (!tagged.length || length <= 0) return keyframes;
  const span = slot === 'enter' ? Math.max(...tagged.map((k) => k.t)) : 1 - Math.min(...tagged.map((k) => k.t));
  if (span <= 0) return keyframes;
  const k = Math.min(1, PRESET_REACH / (span * length));
  if (k >= 1) return keyframes;
  return keyframes.map((f) => (f.preset !== slot ? f : { ...f, t: round(slot === 'enter' ? f.t * k : 1 - (1 - f.t) * k, T_DIGITS) }));
}

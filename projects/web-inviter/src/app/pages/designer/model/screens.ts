import { REFERENCE_VIEWPORT, type DesignElement, type DesignScene } from './scene';
import { cloneElement, insertElement, moveWhole, removeElement, scrollRange } from './scene-ops';

/**
 * Screens: a design's scroll cut into phone-screen lengths (844 units each, the "Scrolls for N screens"
 * of the Page panel). On a stage an element is on the screens its bar runs through (no bar: all of them);
 * on a scrolling page, on the screens its box sits on. Screen numbers start at 1.
 */
export const SCREEN = REFERENCE_VIEWPORT;

export type ScreenSpan = { from: number; to: number } | 'all';

export function screenCount(scene: DesignScene): number {
  return Math.max(1, Math.floor(scrollRange(scene) / SCREEN) + 1);
}

/** The scroll at which a screen fills the phone. */
export function screenScroll(n: number): number {
  return (n - 1) * SCREEN;
}

export function screensOf(scene: DesignScene, el: DesignElement): ScreenSpan {
  if (scene.stage) {
    if (!el.track) return 'all';
    const from = Math.floor(Math.max(0, el.track.start) / SCREEN) + 1;
    return { from, to: Math.max(from, Math.ceil(el.track.end / SCREEN)) };
  }
  const from = Math.floor(Math.max(0, el.y) / SCREEN) + 1;
  return { from, to: Math.max(from, Math.floor(Math.max(0, el.y + el.h - 1) / SCREEN) + 1) };
}

export function describeSpan(span: ScreenSpan): string {
  return span === 'all' ? 'all screens' : span.from === span.to ? `screen ${span.from}` : `screens ${span.from}-${span.to}`;
}

/** Moved by whole screens: its bar on a stage, its place (and motion) on a scrolling page. */
export function shiftScreens(scene: DesignScene, el: DesignElement, screens: number): DesignElement {
  const d = screens * SCREEN;
  if (!d) return el;
  // Bars are scroll positions at every depth (a piece of a group has its own), so all of them move.
  const bars = (e: DesignElement): DesignElement => ({
    ...e,
    ...(e.track ? { track: { start: e.track.start + d, end: e.track.end + d } } : {}),
    ...(e.children ? { children: e.children.map(bars) } : {}),
  });
  return scene.stage ? bars(el) : bars(moveWhole(el, 0, d));
}

/** No ways in or out, loops or keyframes, on it or anything inside it. */
export function withoutMotion(el: DesignElement): DesignElement {
  return {
    ...el, keyframes: [], enter: null, exit: null, loop: null,
    ...(el.children ? { children: el.children.map(withoutMotion) } : {}),
  };
}

const onScreen = (scene: DesignScene, el: DesignElement, n: number) => {
  const s = screensOf(scene, el);
  return s !== 'all' && s.from === n && s.to === n;
};

/** What's only on a screen (top level), and what crosses into it from others (left alone). */
export function screenContents(scene: DesignScene, n: number): { only: DesignElement[]; crossing: DesignElement[] } {
  const only: DesignElement[] = [];
  const crossing: DesignElement[] = [];
  for (const el of scene.elements) {
    const s = screensOf(scene, el);
    if (onScreen(scene, el, n)) only.push(el);
    else if (s === 'all' || (s.from <= n && s.to >= n)) crossing.push(el);
  }
  return { only, crossing };
}

/**
 * Copies what's only on one screen onto another, as it is there (same places on the phone, same
 * timing within the screen). Things that run across several screens (a background with no bar) stay
 * where they are: they're on the target screen already.
 */
export function copyScreen(scene: DesignScene, from: number, to: number, opts: { stripMotion?: boolean } = {}): { scene: DesignScene; ids: string[]; skipped: DesignElement[] } {
  const { only, crossing } = screenContents(scene, from);
  let next = scene;
  const ids: string[] = [];
  for (const el of only) {
    let copy = shiftScreens(scene, { ...cloneElement(el, 0), name: el.name }, to - from);
    if (opts.stripMotion) copy = withoutMotion(copy);
    next = insertElement(next, copy, null, next.elements.length);
    ids.push(copy.id);
  }
  return { scene: next, ids, skipped: crossing };
}

/** Removes what's only on one screen; things running across other screens too are kept. */
export function clearScreen(scene: DesignScene, n: number): { scene: DesignScene; removed: string[]; kept: DesignElement[] } {
  const { only, crossing } = screenContents(scene, n);
  let next = scene;
  for (const el of only) next = removeElement(next, el.id);
  return { scene: next, removed: only.map((e) => e.id), kept: crossing };
}

import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene, MotionPreset } from './scene';
import { keyframeNotes, keyframeScroll, retimeTrack, snappy, tOn, withPreset } from './keyframe-timing';
import { placeAt, stateAt, trackOf, visibleAt } from './scene-ops';

const scene = (elements: DesignElement[], stage = false): DesignScene =>
  ({ schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], elements, assets: {}, stage, length: 4000 });
const box = (extra: Partial<DesignElement> = {}): DesignElement => ({
  id: 'a', type: 'shape', x: 100, y: 300, w: 100, h: 60, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: null, strokeWidth: 0, radius: 0 }, ...extra,
});
// Where each keyframe is, to the hundredth of a unit the compiler writes (t to five places).
const at = (s: DesignScene, el: DesignElement) => el.keyframes.map((k) => Math.round(keyframeScroll(trackOf(s, el), k.t) * 10) / 10);
const fade = (slot: 'enter' | 'exit'): MotionPreset => ({
  id: 'fade', label: slot === 'enter' ? 'Fade in' : 'Fade out',
  frames: slot === 'enter'
    ? [{ t: 0, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 0 }, { t: 0.15, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 1 }]
    : [{ t: 0.85, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 1 }, { t: 1, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 0 }],
});

describe('trimming a bar', () => {
  // A way in over 1000-1150, a keyframe placed by hand at 1500, a way out over 1850-2000.
  const el = box({
    track: { start: 1000, end: 2000 },
    keyframes: [
      { t: 0, opacity: 0, preset: 'enter' }, { t: 0.15, opacity: 1, preset: 'enter' },
      { t: 0.5, x: 160 },
      { t: 0.85, opacity: 1, preset: 'exit' }, { t: 1, opacity: 0, preset: 'exit' },
    ],
  });
  const s = scene([el]);

  it('keeps keyframes placed by hand where they are, and the ways in and out at their ends, the same length', () => {
    const longer = retimeTrack(s, el, { start: 800, end: 2600 }).element;
    expect(longer.track).toEqual({ start: 800, end: 2600 });
    expect(at(s, longer)).toEqual([800, 950, 1500, 2450, 2600]);
    const shorter = retimeTrack(s, el, { start: 1200, end: 1800 }).element;
    expect(at(s, shorter)).toEqual([1200, 1350, 1500, 1650, 1800]);
  });

  it('stops at a keyframe it would cut off, and says so', () => {
    const r = retimeTrack(s, el, { start: 1600, end: 2000 });
    expect(r.blockedAt).toBe(1600);
    expect(r.element.track).toEqual({ start: 1500, end: 2000 });
    const free = r.element.keyframes.find((k) => !k.preset)!;
    expect(keyframeScroll(r.element.track!, free.t)).toBeCloseTo(1500, 1);
  });

  it('squeezes a way in and out that no longer fit side by side, keeping their proportions', () => {
    const plain = box({ track: { start: 0, end: 1000 }, keyframes: el.keyframes.filter((k) => k.preset) });
    const r = retimeTrack(scene([plain]), plain, { start: 0, end: 200 }).element;
    expect(at(scene([plain]), r)).toEqual([0, 100, 100, 200]);
  });

  it('stretches motion across the bar with it', () => {
    const across = box({ track: { start: 0, end: 1000 }, keyframes: [{ t: 0, scale: 1, preset: 'bar' }, { t: 1, scale: 1.2, preset: 'bar' }] });
    const r = retimeTrack(scene([across]), across, { start: 0, end: 3000 }).element;
    expect(r.keyframes.map((k) => k.t)).toEqual([0, 1]);
  });

  it('plays the same at every keyframe after trimming', () => {
    const r = retimeTrack(s, el, { start: 700, end: 2300 }).element;
    const s2 = scene([r]);
    expect(stateAt(s2, r, 1500).x).toBeCloseTo(160, 6);
    expect(stateAt(s2, r, 700).opacity).toBe(0);
    expect(stateAt(s2, r, 850).opacity).toBe(1);
    expect(stateAt(s2, r, 2300).opacity).toBe(0);
  });
});

describe('precision', () => {
  it('stores t to five places — what the compiler writes — and whole scroll units round-trip', () => {
    const track = { start: 137, end: 84_137 };
    for (const scroll of [137, 138, 5000, 44_444, 84_136, 84_137]) expect(Math.round(keyframeScroll(track, tOn(track, scroll)))).toBe(scroll);
  });

  it('a change at the playhead within a unit of a keyframe is that keyframe; two units on is a new one', () => {
    const el = box({ track: { start: 0, end: 2000 }, keyframes: [{ t: tOn({ start: 0, end: 2000 }, 500), x: 100 }] });
    const s = scene([el]);
    expect(placeAt(s, el, 501, { x: 120 }).element.keyframes).toHaveLength(1);
    expect(placeAt(s, el, 502, { x: 120 }).element.keyframes).toHaveLength(2);
  });

  it('squeezes presets on a long bar to a thumb flick, at five places', () => {
    const frames = [{ t: 0, opacity: 0, preset: 'enter' as const }, { t: 0.15, opacity: 1, preset: 'enter' as const }];
    const out = snappy(frames, 'enter', 5000);
    expect(keyframeScroll({ start: 0, end: 5000 }, out[1].t)).toBeCloseTo(260, 1);
  });

  it('a preset on a bar that exists takes a thumb flick too, on a page as on a stage', () => {
    const el = box({ track: { start: 0, end: 3000 } });
    const s = scene([el]);
    const next = withPreset(s, el, fade('enter'), 'enter', [fade('enter')], { start: 0, end: 3000 });
    expect(at(s, next)).toEqual([0, 260]);
  });
});

describe('stage clip ends', () => {
  it('is gone at its bar end, except at the very bottom of the page', () => {
    const mid = box({ track: { start: 100, end: 1000 } });
    const toEnd = box({ id: 'b', track: { start: 100, end: 4000 } });
    const s = scene([mid, toEnd], true);
    expect(visibleAt(s, mid, 999)).toBe(true);
    expect(visibleAt(s, mid, 1000)).toBe(false);
    expect(visibleAt(s, toEnd, 4000)).toBe(true);
  });
});

describe('what each keyframe says', () => {
  it('names a preset and where it starts and ends, and what changes otherwise', () => {
    const el = box({
      enter: 'fade', exit: 'fade', track: { start: 0, end: 1000 },
      keyframes: [
        { t: 0, opacity: 0, preset: 'enter' }, { t: 0.15, opacity: 1, preset: 'enter' },
        { t: 0.4, x: 100 }, { t: 0.5, x: 150, rotate: 20 }, { t: 0.6, x: 150 },
        { t: 0.85, opacity: 1, preset: 'exit' }, { t: 1, opacity: 0, preset: 'exit' },
      ],
    });
    const names = (slot: 'enter' | 'exit') => (slot === 'enter' ? 'Fade in' : 'Fade out');
    const notes = keyframeNotes(scene([el]), el, names);
    expect(notes.map((n) => n.label)).toEqual([
      'Fade in starts', 'Fade in ends', 'Holds until here', 'Move, turn', 'Holds until here', 'Fade out starts', 'Fade out ends',
    ]);
    expect(notes.map((n) => n.at)).toEqual([0, 150, 400, 500, 600, 850, 1000]);
  });
});

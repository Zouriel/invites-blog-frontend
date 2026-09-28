import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene, LoopPreset, MotionPreset } from './scene';
import { applyLoop, applyPreset, effectAt, flatten, pageBoxAt, pivotShift, stateAt } from './scene-ops';
import { followPath, staggerChildren } from './motion-tools';
import { STICKERS, buildSticker } from './stickers';

const theme = [
  { key: 'accent', label: 'Accent', value: '#8c2f39' }, { key: 'bg', label: 'Bg', value: '#ffffff' },
  { key: 'text', label: 'Text', value: '#222222' }, { key: 'gold', label: 'Gold', value: '#c9a45c' },
];
const scene = (elements: DesignElement[]): DesignScene => ({ schema: 3, canvas: {}, theme, fonts: [], roles: [], fields: [], elements, assets: {} });
const box = (id: string, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, type: 'shape', x: 100, y: 400, w: 100, h: 60, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: 'theme:accent', strokeWidth: 0, radius: 0 }, ...extra,
});

describe('presets with the motion extras', () => {
  it('writes 3D and clip values and states the resting ones at the far end', () => {
    const flip: MotionPreset = { id: 'flip', label: 'Flip', frames: [{ t: 0, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 0, rotateX: 90 }, { t: 0.15, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 1 }] };
    const el = applyPreset(box('a'), flip, 'enter');
    expect(el.keyframes[0]).toMatchObject({ t: 0, rotateX: 90, opacity: 0 });
    expect(el.keyframes[1]).toMatchObject({ t: 0.15, rotateX: 0, opacity: 1 });

    const wipe: MotionPreset = { id: 'w', label: 'Wipe', clipShape: 'inset', origin: [0, 0.5], frames: [{ t: 0, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 1, clip: [0, 100, 0, 0] }, { t: 0.15, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 1 }] };
    const w = applyPreset(box('b'), wipe, 'enter');
    expect(w.clipShape).toBe('inset');
    expect(w.origin).toEqual({ x: 0, y: 0.5 });
    expect(w.keyframes[1].clip).toEqual([0, 0, 0, 0]);
  });

  it('scales a loop preset by its strength about "no change"', () => {
    const pulse: LoopPreset = { id: 'pulse', label: 'Pulse', repeat: 6, alternate: false, frames: [{ t: 0, dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 }, { t: 0.5, dx: 0, dy: -10, rotate: 0, scale: 1.1, opacity: 0.5 }, { t: 1, dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 }] };
    const el = applyLoop(box('a'), pulse, 2);
    expect(el.loop).toMatchObject({ preset: 'pulse', repeat: 6, strength: 2 });
    expect(el.loop!.frames[1]).toMatchObject({ dy: -20, scale: 1.2, opacity: 0 });
    expect(applyLoop(el, null).loop).toBeNull();
  });
});

describe('effects at the playhead', () => {
  it('carries a value forward and eases between keyframes', () => {
    const el = box('a', { track: { start: 0, end: 100 }, keyframes: [{ t: 0, blur: 10 }, { t: 0.5 }, { t: 1, blur: 0 }] });
    const sc = scene([el]);
    expect(effectAt(sc, el, 'blur', 25)).toBe(10);
    expect(effectAt(sc, el, 'blur', 75)).toBe(5);
    expect(effectAt(sc, el, 'draw', 50)).toBe(1);
  });
});

describe('a pivot', () => {
  it('draws the box where turning about the pivot puts it', () => {
    const el = box('a', { origin: { x: 0.5, y: 0 }, rotate: 180 });
    // Turned half round about its top centre, it swings up over the pivot: the centre rises by its height.
    const shift = pivotShift(el, { rotate: 180, scale: 1 });
    expect(shift.x).toBeCloseTo(0, 6);
    expect(shift.y).toBeCloseTo(-60, 6);
    expect(pageBoxAt(scene([el]), 'a', 0)!.y).toBeCloseTo(340, 6);
    // A quarter turn about the top-left corner: the centre swings from (+50, +30) to (−30, +50) of it.
    const corner = pivotShift(box('c', { origin: { x: 0, y: 0 } }), { rotate: 90, scale: 1 });
    expect(corner.x).toBeCloseTo(-80, 6);
    expect(corner.y).toBeCloseTo(20, 6);
    expect(pivotShift(box('b'), { rotate: 90, scale: 2 })).toEqual({ x: 0, y: 0 });
  });
});

describe('stagger', () => {
  it('spaces moving children from the earliest start, in order, and never accumulates', () => {
    const kids = ['a', 'b', 'c'].map((id, i) => box(id, { track: { start: 100 + i * 5, end: 400 + i * 5 }, keyframes: [{ t: 0 }] }));
    const still = box('still');
    const g: DesignElement = { ...box('g'), type: 'group', shape: null, children: [...kids, still] };
    let sc = staggerChildren(scene([g]), 'g', 50, 'forward');
    sc = staggerChildren(sc, 'g', 50, 'forward');
    const tracks = sc.elements[0].children!.map((c) => c.track);
    expect(tracks).toEqual([{ start: 100, end: 400 }, { start: 150, end: 450 }, { start: 200, end: 500 }, undefined]);
    const rev = staggerChildren(sc, 'g', 50, 'reverse').elements[0].children!.map((c) => c.track?.start);
    expect(rev.slice(0, 3)).toEqual([200, 150, 100]);
  });
});

describe('follow a path', () => {
  it('puts the element’s centre on the path from one end to the other', () => {
    const line: DesignElement = box('line', { x: 0, y: 500, w: 390, h: 4, shape: { kind: 'line', sides: 6, stroke: 'theme:text', strokeWidth: 2, radius: 0 } });
    const mover = box('m', { w: 40, h: 40 });
    const sc = followPath(scene([line, mover]), 'm', 'line', false, 5);
    const k = sc.elements[1].keyframes;
    expect(k.length).toBe(5);
    expect(k[0]).toMatchObject({ t: 0, x: -20, y: 482 });
    expect(k[4]).toMatchObject({ t: 1, x: 370, y: 482 });
    expect(k[2].x).toBeCloseTo(175, 1);
  });

  it('turns to face the way it goes around a circle, without spinning back', () => {
    const ring: DesignElement = box('ring', { x: 0, y: 0, w: 200, h: 200, shape: { kind: 'ellipse', sides: 6, strokeWidth: 0, radius: 0 } });
    const sc = followPath(scene([ring, box('m')]), 'm', 'ring', true, 24);
    const rot = sc.elements[1].keyframes.map((k) => k.rotate!);
    for (let i = 1; i < rot.length; i++) expect(Math.abs(rot[i] - rot[i - 1])).toBeLessThan(40);
    expect(Math.abs(rot[rot.length - 1] - rot[0])).toBeGreaterThan(300);
  });
});

describe('stickers', () => {
  it.each(STICKERS.map((s) => s.id))('%s builds a well-formed group in the theme’s colours', (id) => {
    const sc = scene([]);
    const g = buildSticker(sc, id, 42, 1000)!;
    expect(g.type).toBe('group');
    expect(g.recipe).toEqual({ id, seed: 42 });
    const all = flatten(scene([g])).map((f) => f.element);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(Math.max(...flatten(scene([g])).map((f) => f.depth))).toBeLessThan(3);
    for (const e of all) {
      for (const c of [e.shape?.fill, e.shape?.stroke]) if (c) expect(c).toMatch(/^theme:/);
      expect(e.keyframes.length).toBeLessThanOrEqual(24);
      if (e.track) expect(e.track.end).toBeGreaterThan(e.track.start);
      if (e.loop) expect(e.loop.repeat).toBeGreaterThanOrEqual(1);
    }
    // The same seed lays it out the same way; another doesn't.
    const again = buildSticker(sc, id, 42, 1000)!;
    const strip = (x: DesignElement) => JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v));
    expect(strip(again)).toBe(strip(g));
  });

  it('falls with the page: petals are near the top of the screen at the start and gone below at the end', () => {
    const g = buildSticker(scene([]), 'petals', 3, 2000)!;
    const sc = scene([g]);
    const petal = g.children![0];
    const early = stateAt(sc, petal, petal.track!.start);
    const late = stateAt(sc, petal, petal.track!.end);
    expect(late.y - early.y).toBeGreaterThan(700);
  });
});

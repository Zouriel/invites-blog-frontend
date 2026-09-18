import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene } from './scene';
import {
  applyPreset, createElement, ease, flatten, groupElements, liftAt, pageHeight, placeAt, reorderElement, resolveFrames, sameScene, scrollRange,
  spanOf, stateAt, timelineLength, trackOf, ungroupElement, upgradeScene, pageBoxAt, runsToTokens, tokensToRuns,
} from './scene-ops';

function scene(elements: DesignElement[] = []): DesignScene {
  return {
    schema: 3,
    canvas: {},
    theme: [{ key: 'accent', label: 'Accent', value: '#b08d57' }, { key: 'bg', label: 'Bg', value: '#ffffff' }, { key: 'text', label: 'Text', value: '#111111' }],
    fonts: [],
    roles: [],
    fields: [],
    elements,
    assets: {},
  };
}

function el(extra: Partial<DesignElement> = {}): DesignElement {
  return { id: 'a', type: 'text', x: 10, y: 100, w: 100, h: 40, rotate: 0, scale: 1, opacity: 1, keyframes: [], ...extra };
}

describe('page metrics', () => {
  it('ends where the lowest element does, and is never shorter than a screen', () => {
    expect(scrollRange(scene())).toBe(0);
    expect(pageHeight(scene())).toBe(844);
    const s = scene([el({ y: 100 }), el({ id: 'b', y: 2000, h: 150 })]);
    expect(scrollRange(s)).toBe(2150 - 844);
    expect(pageHeight(s)).toBe(2150);
  });

  it('counts how long a pinned element holds', () => {
    const s = scene([el({ y: 600, h: 244, pinned: true, track: { start: 100, end: 2100 } })]);
    // And the page runs on until it lets go, even past where its bottom meets the screen's.
    expect(scrollRange(s)).toBe(2100);
  });

  it('runs the timeline a screen past the end, and the end is where the last bar ends — motion included', () => {
    const s = scene([el({ y: 2000, h: 150 })]);
    expect(timelineLength(s)).toBe(2150);
    // An exit running past where the content stops keeps the page scrolling until it has played.
    const moving = scene([el({ y: 100, track: { start: 0, end: 3000 }, keyframes: [{ t: 0 }, { t: 1 }] })]);
    expect(scrollRange(moving)).toBe(3000);
    expect(timelineLength(moving)).toBe(3844);
    expect(trackOf(moving, moving.elements[0]).end).toBe(3000);
    // A track inside a group counts too.
    const grouped = scene([el({ id: 'g', type: 'group', y: 0, h: 200, children: [el({ id: 'c', track: { start: 200, end: 1500 }, keyframes: [{ t: 1 }] })] })]);
    expect(scrollRange(grouped)).toBe(1500);
  });

  it("a still element's bar is while it's on screen, up to the end of the page; a moving one's is its track", () => {
    const low = el({ id: 'low', y: 1000, h: 100 });
    const high = el({ id: 'high', y: 100, h: 40 });
    const s = scene([high, low]);
    // The page stops when the lowest element's bottom meets the bottom of the screen, so it never leaves.
    expect(scrollRange(s)).toBe(256);
    expect(spanOf(s, low)).toEqual({ start: 156, end: 256 });
    expect(spanOf(s, high)).toEqual({ start: 0, end: 140 });
    const moving = el({ y: 1000, track: { start: 50, end: 400 }, keyframes: [{ t: 0 }] });
    expect(spanOf(scene([moving]), moving)).toEqual({ start: 50, end: 400 });
    // With motion running on, the page runs on and a still element's bar with it.
    const t = scene([low, el({ id: 'm', y: 100, track: { start: 0, end: 900 }, keyframes: [{ t: 1 }] })]);
    expect(spanOf(t, low)).toEqual({ start: 156, end: 900 });
  });

  it('the last bar ends exactly at the end of the page', () => {
    const s = scene([el({ id: 'a', y: 100, h: 300 }), el({ id: 'b', y: 1400, h: 200 }), el({ id: 'c', y: 700, h: 200, track: { start: 0, end: 700 }, keyframes: [{ t: 1 }] })]);
    const ends = s.elements.map((e) => spanOf(s, e).end);
    expect(Math.max(...ends)).toBe(scrollRange(s));
  });
});

describe('upgrading a design made with screens', () => {
  const old = {
    ...scene([
      el({ id: 'late', y: 1700, track: { start: 900, end: 5000 }, keyframes: [{ t: 0, opacity: 0 }, { t: 1 }] }),
      el({ id: 'whole', y: 100, keyframes: [{ t: 0 }, { t: 1, rotate: 90 }] }),
    ]),
    schema: 2,
    canvas: { sections: [{ id: 's1', name: 'One', height: 844 }, { id: 's2', name: 'Two', height: 844, background: 'theme:accent' }, { id: 's3', name: 'Three', height: 844 }] },
  } as unknown as DesignScene;

  it('turns coloured screens into boxes at the back and keeps motion timed as it was', () => {
    const next = upgradeScene(old);
    expect(next.schema).toBe(3);
    expect(next.canvas.sections).toBeUndefined();
    expect(next.elements[0]).toMatchObject({ id: 'bgs2', type: 'shape', y: 844, h: 844, w: 390, shape: { kind: 'rect', fill: 'theme:accent' } });
    expect(next.elements[1].track).toEqual({ start: 900, end: 1688 });
    expect(next.elements[2].track).toEqual({ start: 0, end: 1688 });
  });

  it('leaves a current design alone', () => {
    const current = scene([el()]);
    expect(upgradeScene(current)).toBe(current);
  });

  it('compares scenes by content, not key order or nulls', () => {
    const a = scene([el({ track: null })]);
    const b = { ...scene([{ ...el(), name: undefined }]), fonts: [] };
    expect(sameScene(a, b)).toBe(true);
    expect(sameScene(a, scene([el({ y: 1 })]))).toBe(false);
  });
});

describe('motion', () => {
  it('resolves frames with carry-forward and held ends, like the compiler', () => {
    const frames = resolveFrames(el({ keyframes: [{ t: 0.2, x: 50 }, { t: 0.6, opacity: 0.5 }] }));
    expect(frames.map((f) => f.t)).toEqual([0, 0.2, 0.6, 1]);
    expect(frames[0].x).toBe(50);
    expect(frames[2].x).toBe(50);
    expect(frames[3].opacity).toBe(0.5);
  });

  it('interpolates within the track and holds outside it', () => {
    const s = scene([el({ track: { start: 100, end: 300 }, keyframes: [{ t: 0, y: 200 }, { t: 1, y: 100 }] })]);
    const e = s.elements[0];
    expect(stateAt(s, e, 0).y).toBe(200);
    expect(stateAt(s, e, 200).y).toBe(150);
    expect(stateAt(s, e, 1000).y).toBe(100);
  });

  it('brings an element in front over its keyframes and back, and sets it on the keyframe at the playhead', () => {
    const sc = scene();
    const a = el({ track: { start: 0, end: 1000 }, keyframes: [{ t: 0 }, { t: 0.5, lift: 30 }, { t: 1, lift: 0 }] });
    expect(liftAt(sc, a, 0)).toBe(0);
    expect(liftAt(sc, a, 250)).toBe(15);
    expect(liftAt(sc, a, 500)).toBe(30);
    expect(liftAt(sc, a, 1000)).toBe(0);

    const placed = placeAt(sc, a, 500, { lift: 12 });
    expect(placed.created).toBe(false);
    expect(placed.element.keyframes[1].lift).toBe(12);
  });

  it('eases the segment that starts at a keyframe', () => {
    expect(ease('ease-in', 0.5)).toBeLessThan(0.5);
    expect(ease('ease-out', 0.5)).toBeGreaterThan(0.5);
    expect(ease('linear', 0.3)).toBe(0.3);
  });

  it('pins carry the element down with the scroll for the length of its track', () => {
    const s = scene([el({ pinned: true, track: { start: 0, end: 500 } })]);
    expect(pageBoxAt(s, 'a', 200)?.y).toBe(300);
    expect(pageBoxAt(s, 'a', 900)?.y).toBe(600);
  });

  it('moving an unanimated element just moves it', () => {
    const s = scene([el()]);
    const r = placeAt(s, s.elements[0], 300, { x: 40 });
    expect(r.created).toBe(false);
    expect(r.element.x).toBe(40);
  });

  it('moving an animated element away from a keyframe creates one with the full state', () => {
    const s = scene([el({ track: { start: 0, end: 1000 }, keyframes: [{ t: 0, y: 100 }, { t: 1, y: 300 }] })]);
    const r = placeAt(s, s.elements[0], 500, { x: 80 });
    expect(r.created).toBe(true);
    const made = r.element.keyframes.find((k) => k.t === 0.5)!;
    expect(made.x).toBe(80);
    expect(made.y).toBe(200);
  });

  it('moving on a keyframe edits it', () => {
    const s = scene([el({ track: { start: 0, end: 1000 }, keyframes: [{ t: 0, y: 100 }, { t: 1, y: 300 }] })]);
    const r = placeAt(s, s.elements[0], 1000, { y: 250 });
    expect(r.created).toBe(false);
    expect(r.element.keyframes[1].y).toBe(250);
  });

  it('presets replace their own slot and state the resting values', () => {
    const preset = { id: 'fade-up', label: 'Fade up', frames: [{ t: 0, dx: 0, dy: 40, dRotate: 0, scale: 1, opacity: 0, easing: 'ease-out' }, { t: 0.15, dx: 0, dy: 0, dRotate: 0, scale: 1, opacity: 1 }] };
    let e = applyPreset(el(), preset, 'enter');
    expect(e.keyframes).toHaveLength(2);
    expect(e.keyframes[0]).toMatchObject({ y: 140, opacity: 0, preset: 'enter' });
    expect(e.keyframes[1]).toMatchObject({ x: 10, y: 100, opacity: 1 });
    e = applyPreset(e, preset, 'enter');
    expect(e.keyframes).toHaveLength(2);
    e = applyPreset(e, null, 'enter');
    expect(e.keyframes).toHaveLength(0);
  });
});

describe('tree', () => {
  it('groups siblings into group-relative coordinates and ungroups back', () => {
    let s = scene([el({ id: 'a', x: 50, y: 60 }), el({ id: 'b', x: 150, y: 200 })]);
    const g = groupElements(s, ['a', 'b']);
    s = g.scene;
    const group = s.elements.find((e) => e.id === g.groupId)!;
    expect(group).toMatchObject({ x: 50, y: 60, w: 200, h: 180 });
    expect(group.children?.map((c) => [c.x, c.y])).toEqual([[0, 0], [100, 140]]);
    expect(pageBoxAt(s, 'b', 0)).toMatchObject({ x: 150, y: 200 });

    s = ungroupElement(s, g.groupId!);
    expect(flatten(s).map((f) => [f.element.id, f.element.x, f.element.y])).toEqual([['a', 50, 60], ['b', 150, 200]]);
  });

  it('reorders within a list', () => {
    const s = reorderElement(scene([el({ id: 'a' }), el({ id: 'b' }), el({ id: 'c' })]), 'a', 2);
    expect(s.elements.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('creates elements that use the scene theme', () => {
    const rsvp = createElement(scene(), 'rsvp', 400);
    expect(rsvp.button?.fill).toBe('theme:accent');
    expect(rsvp.y).toBe(373);
  });

  it('converts runs to token-input runs and back', () => {
    const runs = [{ text: 'Hi ' }, { var: 'guest.name', bold: true }];
    expect(tokensToRuns(runsToTokens(runs))).toEqual(runs);
  });
});

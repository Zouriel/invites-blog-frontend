import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { DesignElement, DesignKeyframe, DesignScene } from './scene';
import { EFFECT_MOVES, PACES, applyMove, asPreview, movesFor, type EffectMove } from './effect-moves';
import { effectAt, findElement, progressAt, scrollRange, stateAt, trackOf, visibleAt, type EffectProp } from './scene-ops';

const theme = [
  { key: 'accent', label: 'Accent', value: '#8c2f39' }, { key: 'bg', label: 'Bg', value: '#ffffff' },
  { key: 'text', label: 'Text', value: '#222222' }, { key: 'gold', label: 'Gold', value: '#c9a45c' },
];
const scene = (elements: DesignElement[], extra: Partial<DesignScene> = {}): DesignScene =>
  ({ schema: 3, canvas: {}, theme, fonts: [], roles: [], fields: [], elements, assets: {}, ...extra });
const shape = (id: string, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, type: 'shape', x: 100, y: 300, w: 120, h: 80, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: 'theme:accent', stroke: 'theme:gold', strokeWidth: 3, radius: 0 }, ...extra,
});
const text = (id: string, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, type: 'text', x: 60, y: 200, w: 260, h: 60, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  text: { runs: [{ text: 'Save the date' }], style: { font: 'theme:heading-font', size: 32, weight: 600, color: 'theme:text', align: 'center', valign: 'middle', lineHeight: 1.2, letterSpacing: 0 } }, ...extra,
} as DesignElement);
/** Something to give the page length, so a move has room. */
const filler = (): DesignElement => shape('filler', { y: 2400 });

const NUMERIC: EffectProp[] = ['rotateX', 'rotateY', 'skewX', 'blur', 'draw', 'tracking'];
const elementFor = (m: EffectMove) => (m.only === 'text' ? text('a') : shape('a'));

/** The clip values in force at a scroll position — the last keyframe at or before it that sets any. */
function clipAt(s: DesignScene, el: DesignElement, scroll: number): number[] | null {
  const t = progressAt(s, el, scroll);
  const set = el.keyframes.filter((k) => k.clip?.length && k.t <= t + 1e-4).sort((a, b) => a.t - b.t);
  return set.length ? set[set.length - 1].clip! : null;
}

describe('effect moves', () => {
  it('every move has a distinct id, a plain-words label, and a start that differs from its end', () => {
    expect(new Set(EFFECT_MOVES.map((m) => m.id)).size).toBe(EFFECT_MOVES.length);
    for (const m of EFFECT_MOVES) {
      expect(m.label).toMatch(/^[A-Z][a-z ]+$/);
      expect(m.from).not.toEqual(m.to);
      expect(Object.keys(m.from).sort()).toEqual(Object.keys(m.to).sort());
    }
  });

  it('only offers outline moves on shapes and letter moves on text', () => {
    const onShape = movesFor(shape('a')).map((m) => m.id);
    const onText = movesFor(text('a')).map((m) => m.id);
    const onImage = movesFor({ ...shape('a'), type: 'image' }).map((m) => m.id);
    expect(onShape).toContain('draw');
    expect(onShape).not.toContain('letters-close');
    expect(onText).toContain('letters-close');
    expect(onText).not.toContain('draw');
    expect(onImage).not.toContain('draw');
    expect(onImage).toContain('door-open');
  });

  for (const stage of [false, true]) {
    for (const move of EFFECT_MOVES) {
      for (const pace of PACES) {
        it(`${move.label} at a ${pace.label.toLowerCase()} pace (${stage ? 'stage' : 'page'})`, () => {
          const s0 = scene([elementFor(move), filler()], { stage });
          const from = 500;
          const s = applyMove(s0, 'a', move, from, pace.units);
          const el = findElement(s, 'a')!;
          const end = from + pace.units;

          // A bar that holds it, from the top of the page so it's there before the effect starts.
          expect(el.track).toBeTruthy();
          expect(el.track!.start).toBe(0);
          expect(el.track!.end).toBeGreaterThanOrEqual(end);
          expect(el.keyframes.length).toBe(2);

          // The values at the start and end of the move, and in between on the way.
          for (const prop of NUMERIC) {
            const a = (move.from as Record<string, number | undefined>)[prop];
            const b = (move.to as Record<string, number | undefined>)[prop];
            if (a === undefined) continue;
            expect(effectAt(s, el, prop, from)).toBeCloseTo(a, 1);
            expect(effectAt(s, el, prop, end)).toBeCloseTo(b!, 1);
            expect(effectAt(s, el, prop, end + 400)).toBeCloseTo(b!, 1);
            const mid = effectAt(s, el, prop, from + pace.units / 2);
            expect(mid).toBeGreaterThanOrEqual(Math.min(a, b!) - 1e-6);
            expect(mid).toBeLessThanOrEqual(Math.max(a, b!) + 1e-6);
            expect(mid === a && mid === b).toBe(false);
          }
          if (move.from.opacity !== undefined) {
            expect(stateAt(s, el, from).opacity).toBeCloseTo(move.from.opacity, 1);
            expect(stateAt(s, el, end).opacity).toBeCloseTo(move.to.opacity!, 1);
          }
          if (move.from.clip) {
            expect(el.clipShape).toBe(move.clipShape);
            expect(clipAt(s, el, from)).toEqual(move.from.clip);
            expect(clipAt(s, el, end)).toEqual(move.to.clip);
          }
          if (move.origin) expect(el.origin).toEqual(move.origin);

          // It doesn't move or resize what it's applied to.
          expect(stateAt(s, el, end)).toMatchObject({ x: el.x, y: el.y, rotate: 0, scale: 1 });
          // On a stage a bar is a clip: this one mustn't cut the element off before, during or after.
          for (const at of [0, from, end, scrollRange(s)]) expect(visibleAt(s, el, at)).toBe(true);
        });
      }
    }
  }

  it('keeps what the element already does where it was', () => {
    // A slide across from 0 to 1000, then a door opening from 1500: the slide keeps its timing.
    const moving = shape('a', { track: { start: 0, end: 1000 }, keyframes: [{ t: 0, x: 0 }, { t: 1, x: 200 }] });
    const s0 = scene([moving, filler()]);
    const s = applyMove(s0, 'a', EFFECT_MOVES.find((m) => m.id === 'door-open')!, 1500, 360);
    const el = findElement(s, 'a')!;
    expect(el.track).toEqual({ start: 0, end: 1860 });
    expect(stateAt(s, el, 500).x).toBeCloseTo(100, 1);
    expect(stateAt(s, el, 1000).x).toBeCloseTo(200, 1);
    expect(effectAt(s, el, 'rotateY', 1000)).toBe(0);
    expect(effectAt(s, el, 'rotateY', 1860)).toBeCloseTo(-85, 1);
  });

  it('adds to a keyframe already at the playhead instead of stacking another', () => {
    const el0 = shape('a', { track: { start: 0, end: 1000 }, keyframes: [{ t: 0.5, x: 50 }, { t: 1, x: 80 }] });
    const s = applyMove(scene([el0]), 'a', EFFECT_MOVES.find((m) => m.id === 'focus-in')!, 500, 500);
    const frames = findElement(s, 'a')!.keyframes;
    expect(frames.length).toBe(2);
    expect(frames[0]).toMatchObject({ t: 0.5, x: 50, blur: 12, opacity: 0.4 });
    expect(frames[1]).toMatchObject({ t: 1, x: 80, blur: 0, opacity: 1 });
  });

  it('two moves one after another both play', () => {
    const moves = new Map(EFFECT_MOVES.map((m) => [m.id, m]));
    let s = scene([shape('a'), filler()], { stage: true });
    s = applyMove(s, 'a', moves.get('focus-in')!, 100, 360);
    s = applyMove(s, 'a', moves.get('coin')!, 600, 360);
    const el = findElement(s, 'a')!;
    expect(effectAt(s, el, 'blur', 100)).toBeCloseTo(12, 1);
    expect(effectAt(s, el, 'blur', 460)).toBeCloseTo(0, 1);
    expect(effectAt(s, el, 'rotateY', 600)).toBeCloseTo(0, 1);
    expect(effectAt(s, el, 'rotateY', 960)).toBeCloseTo(360, 1);
    expect(trackOf(s, el).end).toBeGreaterThanOrEqual(960);
  });

  it('a reveal after a circle cut drops the circle values, which mean nothing for a box', () => {
    const moves = new Map(EFFECT_MOVES.map((m) => [m.id, m]));
    let s = scene([shape('a'), filler()]);
    s = applyMove(s, 'a', moves.get('iris-open')!, 100, 180);
    s = applyMove(s, 'a', moves.get('reveal-right')!, 800, 180);
    const el = findElement(s, 'a')!;
    expect(el.clipShape).toBe('inset');
    expect(el.keyframes.every((k: DesignKeyframe) => !k.clip || k.clip.length === 4)).toBe(true);
  });

  it('previews as a preset the thumbnails can play', () => {
    for (const m of EFFECT_MOVES) {
      const p = asPreview(m);
      expect(p.frames.length).toBe(2);
      expect(p.frames[0]).toMatchObject({ t: 0, dx: 0, dy: 0, scale: 1 });
      expect(p.frames[1].t).toBe(1);
      if (m.origin) expect(p.origin).toEqual([m.origin.x, m.origin.y]);
    }
  });

  // Every move on every kind of design, for the server to compile against the editor's compiler.
  it('writes every move when asked', () => {
    const out = process.env['EFFECTS_OUT'];
    if (!out) return;
    const cases: { name: string; scene: DesignScene }[] = [];
    for (const stage of [false, true]) {
      for (const move of EFFECT_MOVES) {
        const s = applyMove(scene([elementFor(move), filler()], { stage }), 'a', move, 400, 360);
        cases.push({ name: `effect-${move.id}-${stage ? 'stage' : 'page'}`, scene: s });
      }
    }
    writeFileSync(out, JSON.stringify(cases));
  });
});

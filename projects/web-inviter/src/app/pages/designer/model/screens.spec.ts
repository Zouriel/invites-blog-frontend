import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene } from './scene';
import { clearScreen, copyScreen, screenCount, screensOf } from './screens';

const el = (id: string, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, type: 'shape', x: 20, y: 100, w: 100, h: 50, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: '#000', strokeWidth: 0, radius: 0 }, ...extra,
});
const stage = (elements: DesignElement[]): DesignScene =>
  ({ schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], assets: {}, stage: true, length: 2532, elements }) as unknown as DesignScene;

describe('screens', () => {
  const bg = el('bg', { y: 0, h: 844 }); // no bar: all along
  const s1 = el('t1', { track: { start: 0, end: 844 } });
  const s2 = el('t2', { track: { start: 844, end: 1688 }, enter: 'fade', keyframes: [{ t: 0, opacity: 0, preset: 'enter' }, { t: 0.1, opacity: 1, preset: 'enter' }] });
  const both = el('t12', { track: { start: 400, end: 1200 } });
  const group = el('g', { type: 'group', shape: null, track: { start: 844, end: 1688 }, children: [el('c', { track: { start: 900, end: 1600 } })] });

  it('says which screens a thing is on: its bar on a stage, its box on a scrolling page', () => {
    const scene = stage([bg, s1, s2, both]);
    expect(screenCount(scene)).toBe(4);
    expect([screensOf(scene, bg), screensOf(scene, s1), screensOf(scene, s2), screensOf(scene, both)]).toEqual(['all', { from: 1, to: 1 }, { from: 2, to: 2 }, { from: 1, to: 2 }]);
    const page = { ...scene, stage: false };
    expect(screensOf(page, el('x', { y: 900, h: 40 }))).toEqual({ from: 2, to: 2 });
    expect(screensOf(page, el('x', { y: 800, h: 100 }))).toEqual({ from: 1, to: 2 });
  });

  it('copies what is only on one screen onto another, bars inside groups too, leaving what crosses screens', () => {
    const r = copyScreen(stage([bg, s1, s2, both, group]), 2, 4);
    expect(r.ids).toHaveLength(2);
    expect(r.skipped.map((e) => e.id)).toEqual(['bg', 't12']);
    const [copy, groupCopy] = r.ids.map((id) => r.scene.elements.find((e) => e.id === id)!);
    expect(copy.track).toEqual({ start: 2532, end: 3376 });
    expect([copy.x, copy.y, copy.name]).toEqual([20, 100, undefined]); // same place on the phone
    expect(copy.enter).toBe('fade'); // motion kept
    expect(groupCopy.track).toEqual({ start: 2532, end: 3376 });
    expect(groupCopy.children![0].track).toEqual({ start: 2588, end: 3288 });
  });

  it('can copy without motion, and on a scrolling page moves the copies down by whole screens', () => {
    const still = copyScreen(stage([s2]), 2, 3, { stripMotion: true });
    const c = still.scene.elements.at(-1)!;
    expect([c.enter, c.keyframes.length]).toEqual([null, 0]);
    const page = { ...stage([el('p', { y: 900, keyframes: [{ t: 0.5, y: 950 }] })]), stage: false };
    const moved = copyScreen(page, 2, 3).scene.elements.at(-1)!;
    expect([moved.y, moved.keyframes[0].y]).toEqual([1744, 1794]);
  });

  it('clears only what is only on that screen', () => {
    const r = clearScreen(stage([bg, s1, s2, both]), 2);
    expect(r.removed).toEqual(['t2']);
    expect(r.kept.map((e) => e.id)).toEqual(['bg', 't12']);
    expect(r.scene.elements.map((e) => e.id)).toEqual(['bg', 't1', 't12']);
  });
});

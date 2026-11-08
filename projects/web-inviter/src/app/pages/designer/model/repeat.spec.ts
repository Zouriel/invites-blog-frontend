import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene } from './scene';
import { findElement, flatten, pageBoxAt } from './scene-ops';
import { repeatElement, repeatOf, repeatPlaces, ringRadius, type RepeatSpec } from './repeat';

const petal = (extra: Partial<DesignElement> = {}): DesignElement => ({
  id: 'p1', type: 'shape', name: 'Petal', x: 175, y: 100, w: 40, h: 100, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'ellipse', sides: 6, fill: 'theme:accent', stroke: null, strokeWidth: 0, radius: 0 }, ...extra,
});

const scene = (elements: DesignElement[]): DesignScene => ({
  schema: 3, canvas: {}, theme: [{ key: 'accent', label: 'Accent', value: '#b08d57' }], fonts: [], roles: [], fields: [], elements, assets: {},
});

/** Centre and turn of each piece of a repeat group, on the page. */
function pieces(s: DesignScene, groupId: string) {
  const group = findElement(s, groupId)!;
  return group.children!.map((c) => {
    const b = pageBoxAt(s, c.id, 0)!;
    return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rotate: b.rotate, id: c.id };
  });
}

describe('repeat', () => {
  it('lays petals round a centre, each turned to face out: a flower', () => {
    const el = petal();
    const r = ringRadius(el, 8, 'petals');
    expect(r).toBe(50);
    const result = repeatElement(scene([el]), 'p1', { kind: 'circle', count: 8, radius: r, faceOut: true, startAngle: 0 });
    if ('error' in result) throw new Error(result.error);
    const ps = pieces(result.scene, result.groupId);
    expect(ps).toHaveLength(8);
    // The original keeps its id and place; the circle's centre is below it, at its base.
    expect(ps[0]).toMatchObject({ id: 'p1', cx: 195, cy: 150, rotate: 0 });
    const centre = { x: 195, y: 200 };
    for (const [i, p] of ps.entries()) {
      expect(Math.hypot(p.cx - centre.x, p.cy - centre.y)).toBeCloseTo(50, 0);
      expect(p.rotate).toBeCloseTo(i * 45, 5);
      // Facing out: the petal's own "up" points away from the centre.
      const a = (p.rotate * Math.PI) / 180;
      const up = { x: Math.sin(a), y: -Math.cos(a) };
      const out = { x: (p.cx - centre.x) / 50, y: (p.cy - centre.y) / 50 };
      expect(up.x * out.x + up.y * out.y).toBeCloseTo(1, 2);
    }
    // Every piece's base meets the middle, so they read as one flower.
    const group = findElement(result.scene, result.groupId)!;
    expect(group.type).toBe('group');
    expect(group.name).toBe('Ring of 8');
    // Its box covers the turned petals too (handles and taps reach the whole flower): 100 out each way.
    expect(group).toMatchObject({ x: 95, y: 100, w: 200, h: 200 });
    expect(flatten(result.scene).filter((f) => f.depth === 0)).toHaveLength(1);
  });

  it('keeps copies upright when they do not face out, and starts where asked', () => {
    const result = repeatElement(scene([petal()]), 'p1', { kind: 'circle', count: 4, radius: 100, faceOut: false, startAngle: 90 });
    if ('error' in result) throw new Error(result.error);
    const ps = pieces(result.scene, result.groupId);
    expect(ps.every((p) => p.rotate === 0)).toBe(true);
    // Start angle 90: the original is at three o'clock, so the centre is 100 to its left.
    expect(ps[1].cx).toBeCloseTo(95, 1);
    expect(ps[1].cy).toBeCloseTo(250, 1);
    expect(ps[2].cx).toBeCloseTo(-5, 1);
  });

  it('fills a grid with gaps, and a line in any direction', () => {
    const grid = repeatPlaces(petal(), { kind: 'grid', columns: 3, rows: 2, gapX: 10, gapY: 5 });
    expect(grid).toHaveLength(6);
    expect(grid[2]).toEqual({ dx: 100, dy: 0, turn: 0 });
    expect(grid[5]).toEqual({ dx: 100, dy: 105, turn: 0 });
    const down = repeatPlaces(petal(), { kind: 'line', count: 3, spacing: 20, angle: 90 });
    expect(down.map((p) => [p.dx, p.dy])).toEqual([[0, 0], [0, 120], [0, 240]]);
    const across = repeatPlaces(petal({ scale: 2 }), { kind: 'line', count: 2, spacing: 0, angle: 0 });
    expect(across[1].dx).toBe(80);
  });

  it('copies motion with each copy, turned with it', () => {
    const el = petal({ keyframes: [{ t: 0, x: 175, y: 100, rotate: 10 }, { t: 1, x: 175, y: 300, rotate: 30 }], track: { start: 0, end: 400 } });
    const result = repeatElement(scene([el]), 'p1', { kind: 'circle', count: 4, radius: 50, faceOut: true, startAngle: 0 });
    if ('error' in result) throw new Error(result.error);
    const group = findElement(result.scene, result.groupId)!;
    const second = group.children![1];
    expect(second.id).not.toBe('p1');
    expect(second.track).toEqual({ start: 0, end: 400 });
    expect(second.keyframes.map((k) => k.rotate)).toEqual([100, 120]);
    // Each keyframe's place moved with the copy: the motion is the same distance down.
    expect(second.keyframes[1].y! - second.keyframes[0].y!).toBe(200);
  });

  it('lays the original out again when the repeat group is selected, keeping the group', () => {
    const first = repeatElement(scene([petal()]), 'p1', { kind: 'circle', count: 6, radius: 50, faceOut: true, startAngle: 0 });
    if ('error' in first) throw new Error(first.error);
    const named = { ...first.scene, elements: first.scene.elements.map((e) => ({ ...e, name: 'My flower', opacity: 0.5 })) };
    expect(repeatOf(named.elements[0])).toMatchObject({ kind: 'circle', count: 6 });
    const again = repeatElement(named, first.groupId, { kind: 'circle', count: 12, radius: 50, faceOut: true, startAngle: 0 });
    if ('error' in again) throw new Error(again.error);
    expect(again.groupId).toBe(first.groupId);
    const group = findElement(again.scene, again.groupId)!;
    expect(group.children).toHaveLength(12);
    expect(group).toMatchObject({ name: 'My flower', opacity: 0.5 });
    expect(again.scene.elements).toHaveLength(1);
    // Still the same flower: the original where it was.
    expect(pieces(again.scene, again.groupId)[0]).toMatchObject({ id: 'p1', cx: 195, cy: 150 });
  });

  it('works inside a group, staying in it', () => {
    const outer: DesignElement = { ...petal({ id: 'g' }), type: 'group', shape: null, x: 10, y: 10, w: 200, h: 200, children: [petal({ x: 0, y: 0 })] };
    const result = repeatElement(scene([outer]), 'p1', { kind: 'line', count: 3, spacing: 4, angle: 0 });
    if ('error' in result) throw new Error(result.error);
    const g = findElement(result.scene, 'g')!;
    expect(g.children).toHaveLength(1);
    expect(g.children![0].id).toBe(result.groupId);
    expect(g.children![0].children).toHaveLength(3);
  });

  it('refuses more than the design may hold', () => {
    const spec: RepeatSpec = { kind: 'grid', columns: 10, rows: 10, gapX: 0, gapY: 0 };
    expect(repeatElement(scene([petal()]), 'p1', spec, 50)).toEqual({ error: expect.stringContaining('50 elements') });
    expect(repeatElement(scene([petal()]), 'nope', spec)).toEqual({ error: expect.any(String) });
  });
});

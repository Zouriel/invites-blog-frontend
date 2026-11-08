import { describe, expect, it } from 'vitest';
import { flattenContour, type UiPathContour } from '@zouriel/ui/canvas';
import type { DesignElement, DesignScene } from './scene';
import { findElement } from './scene-ops';
import { combinable, combineShapes, placedContours } from './combine';

const shape = (id: string, kind: 'rect' | 'ellipse' | 'polygon' | 'line', x: number, y: number, w: number, h: number, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, type: 'shape', name: null, x, y, w, h, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind, sides: 3, fill: id === 'a' ? 'theme:accent' : '#000000', stroke: null, strokeWidth: 0, radius: 0 }, ...extra,
});

const scene = (elements: DesignElement[]): DesignScene => ({
  schema: 3, canvas: {}, theme: [{ key: 'accent', label: 'Accent', value: '#b08d57' }], fonts: [], roles: [], fields: [], elements, assets: {},
});

/** Area filled (non-zero rule) by a drawn shape on the page, measured on a grid. */
function areaOnPage(el: DesignElement, step = 1): number {
  const p = el.shape!.path!;
  const sx = el.w / p.width;
  const sy = el.h / p.height;
  const polys = p.contours.filter((c: UiPathContour) => c.closed).map((c) => flattenContour(c, 16).map((q) => ({ x: el.x + q.x * sx, y: el.y + q.y * sy })));
  let hits = 0;
  for (let y = el.y + step / 2; y < el.y + el.h; y += step)
    for (let x = el.x + step / 2; x < el.x + el.w; x += step) {
      let winding = 0;
      for (const pts of polys)
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          if (a.y <= y && b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) winding++;
          else if (a.y > y && b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) winding--;
        }
      if (winding !== 0) hits++;
    }
  return hits * step * step;
}

const run = (els: DesignElement[], op: 'add' | 'cut' | 'intersect' | 'exclude', ids = els.map((e) => e.id)) => {
  const r = combineShapes(scene(els), ids, op);
  if ('error' in r) throw new Error(r.error);
  return { scene: r.scene, el: findElement(r.scene, r.id)! };
};

describe('combine shapes', () => {
  // Two 100 × 100 boxes overlapping by a 50 × 100 strip: 10000 each, 5000 shared.
  const a = shape('a', 'rect', 0, 0, 100, 100, { name: 'Base', pattern: { kind: 'dots' } });
  const b = shape('b', 'rect', 50, 0, 100, 100);

  it('add makes one shape covering both, with the bottom one’s look', () => {
    const { scene: s, el } = run([a, b], 'add');
    expect(s.elements).toHaveLength(1);
    expect(el).toMatchObject({ id: 'a', name: 'Base', x: 0, y: 0, w: 150, h: 100, pattern: { kind: 'dots' } });
    expect(el.shape).toMatchObject({ kind: 'path', fill: 'theme:accent' });
    // Merged into one outline, not two overlapping ones.
    expect(el.shape!.path!.contours).toHaveLength(1);
    expect(areaOnPage(el)).toBeCloseTo(15000, -2);
  });

  it('cut out takes the top shapes out of the bottom one', () => {
    const { el } = run([a, b], 'cut');
    expect(el).toMatchObject({ x: 0, w: 50 });
    expect(areaOnPage(el)).toBeCloseTo(5000, -2);
  });

  it('overlap keeps only where they overlap; exclude everything but', () => {
    expect(areaOnPage(run([a, b], 'intersect').el)).toBeCloseTo(5000, -2);
    const ex = run([a, b], 'exclude').el;
    expect(ex.w).toBe(150);
    expect(areaOnPage(ex)).toBeCloseTo(10000, -2);
  });

  it('follows paint order, not the order they were picked in', () => {
    const { el } = run([a, b], 'cut', ['b', 'a']);
    expect(el.id).toBe('a');
    expect(el.w).toBe(50);
  });

  it('turns ovals and polygons into outlines where they show: scaled and rotated', () => {
    // A 100 × 20 bar turned 90°, scaled by 2 about its centre (60, 50): it covers 40 wide by 200 tall.
    const bar = shape('a', 'rect', 10, 40, 100, 20, { rotate: 90, scale: 2 });
    const pts = placedContours(bar)[0].points;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(40, 5);
    expect(Math.max(...xs)).toBeCloseTo(80, 5);
    expect(Math.min(...ys)).toBeCloseTo(-50, 5);
    expect(Math.max(...ys)).toBeCloseTo(150, 5);
    const disc = shape('b', 'ellipse', 0, 0, 100, 100);
    const tri = shape('c', 'polygon', 200, 0, 100, 100);
    const { el } = run([disc, tri], 'add');
    expect(el.shape!.path!.contours).toHaveLength(2);
    // A circle of radius 50 (7854) and a triangle of the polygon editor's shape.
    expect(areaOnPage(el)).toBeGreaterThan(7854 + 3000);
    expect(el.rotate).toBe(0);
  });

  it('moves the bottom one’s motion with its new box', () => {
    const moving = shape('a', 'rect', 20, 20, 100, 100, { rotate: 10, keyframes: [{ t: 0, x: 20, y: 20, rotate: 10 }, { t: 1, x: 20, y: 220, rotate: 40 }] });
    const top = shape('b', 'rect', 0, 0, 40, 40);
    const { el } = run([moving, top], 'add');
    expect(el.keyframes[1].y! - el.keyframes[0].y!).toBe(200);
    expect(el.keyframes[0].x).toBe(el.x);
    expect(el.keyframes.map((k) => k.rotate)).toEqual([0, 30]);
  });

  it('says why when they can’t be combined', () => {
    const text: DesignElement = { ...shape('t', 'rect', 0, 0, 10, 10), type: 'text', shape: null };
    expect(combinable(scene([a]), ['a'])).toEqual({ error: expect.stringContaining('two or more') });
    expect(combinable(scene([a, text]), ['a', 't'])).toEqual({ error: expect.stringContaining('Only shapes') });
    expect(combinable(scene([a, shape('l', 'line', 0, 0, 10, 10)]), ['a', 'l'])).toEqual({ error: expect.stringContaining('Lines') });
    const group: DesignElement = { ...shape('g', 'rect', 0, 0, 10, 10), type: 'group', shape: null, children: [shape('c', 'rect', 0, 0, 5, 5)] };
    expect(combinable(scene([a, group]), ['a', 'c'])).toEqual({ error: expect.stringContaining('different groups') });
    const far = shape('b', 'rect', 500, 500, 10, 10);
    expect(combineShapes(scene([a, far]), ['a', 'b'], 'intersect')).toEqual({ error: expect.stringContaining('overlap') });
  });
});

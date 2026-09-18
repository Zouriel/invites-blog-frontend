import { describe, expect, it } from 'vitest';
import {
  contourArea, flattenContour, pathBounds, inkArea, rectContour, reverseContour, type UiInkSample, type UiPathContour, type UiPathItem,
} from '@zouriel/ui/canvas';
import eraseFixture from './erase-fixture.json';
import { MAX_PATH_POINTS, eraseItems, inkToArea, inkToContours, itemsToPath, mergeItems } from './shape-paths';

/** Area of outlines filled with the non-zero rule, measured by sampling a grid. */
function filledArea(contours: UiPathContour[], box: { x: number; y: number; w: number; h: number }, step = 0.5): number {
  const polys = contours.filter((c) => c.closed).map((c) => flattenContour(c, 16));
  let hits = 0;
  for (let y = box.y + step / 2; y < box.y + box.h; y += step) {
    for (let x = box.x + step / 2; x < box.x + box.w; x += step) {
      let winding = 0;
      for (const pts of polys) {
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          if (a.y <= y && b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) winding++;
          else if (a.y > y && b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) winding--;
        }
      }
      if (winding !== 0) hits++;
    }
  }
  return hits * step * step;
}

const polyArea = (mp: number[][][][]) => mp.reduce((sum, poly) => sum + poly.reduce((s, ring, i) => {
  let a = 0;
  for (let k = 0; k < ring.length - 1; k++) a += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
  return s + (Math.abs(a) / 2) * (i ? -1 : 1);
}, 0), 0);

const box = (id: string, x: number, y: number, w: number, h: number, extra: Partial<UiPathItem> = {}): UiPathItem =>
  ({ id, contours: [rectContour(x, y, w, h)], ...extra });

describe('shape paths', () => {
  it('a stroke saves as the outline of exactly what it painted', () => {
    // A loop that crosses itself, with changing pressure.
    const samples: UiInkSample[] = Array.from({ length: 90 }, (_, i) => {
      const t = (i / 89) * Math.PI * 2.4;
      return { x: 50 + 30 * Math.sin(t), y: 50 + 20 * Math.sin(2 * t), pressure: 0.3 + 0.5 * Math.abs(Math.sin(t)) };
    });
    const pieces = inkArea(samples, { kind: 'brush', size: 6 });
    const painted = polyArea(inkToArea(pieces));
    const contours = inkToContours(pieces, 6);
    const saved = filledArea(contours, { x: 10, y: 20, w: 80, h: 60 });
    expect(Math.abs(saved - painted) / painted).toBeLessThan(0.03);
    // Curves, not hundreds of straight bits.
    expect(contours.reduce((n, c) => n + c.points.length, 0)).toBeLessThan(160);
  });

  it('the eraser rubs out what it went over, or whole pieces it touched', () => {
    const cut = inkArea(Array.from({ length: 11 }, (_, i) => ({ x: 50, y: i * 10, pressure: 0.5 })), { kind: 'eraser', size: 10 });
    const items = [box('a', 10, 10, 80, 80), box('b', 200, 200, 10, 10)];
    const erased = eraseItems(items, cut, false);
    expect(erased.map((i) => i.id)).toEqual(['a', 'b']);
    expect(erased[0].contours).toHaveLength(2);
    expect(filledArea(erased[0].contours, { x: 0, y: 0, w: 100, h: 100 })).toBeCloseTo(80 * 70, -2);
    expect(erased[1]).toBe(items[1]);
    expect(eraseItems(items, cut, true).map((i) => i.id)).toEqual(['b']);
  });

  it('strokes cut by the eraser end cleanly at the cut, with no hairline across the gap', () => {
    // Four brushes' strokes and an eraser drawn down through them, recorded from a phone.
    const toXY = (pieces: number[][][]) => pieces.map((p) => p.map(([x, y]) => ({ x, y })));
    const strokes: UiPathItem[] = eraseFixture.strokes.map((s, i) => ({ id: `s${i}`, contours: inkToContours(toXY(s.pieces), s.size) }));
    const eraser = toXY(eraseFixture.eraser);
    const gap = pathBounds(eraser.map((p) => ({ closed: true, points: p })))!;
    for (const item of eraseItems(strokes, eraser, false)) {
      const ends = item.contours.map((c) => pathBounds([c])!).sort((a, b) => a.x - b.x);
      expect(ends).toHaveLength(2);
      expect(ends[0].x + ends[0].w).toBeLessThan(gap.x + 0.5);
      expect(ends[1].x).toBeGreaterThan(gap.x + gap.w - 0.5);
    }
  });

  it('pieces combine as Photoshop does: add, cut out, overlap, exclude', () => {
    const base = box('a', 0, 0, 20, 20);
    const other = (op: UiPathItem['op']) => box('b', 10, 0, 20, 20, { op });
    const area = (op: UiPathItem['op']) => filledArea(mergeItems([base, other(op)]), { x: 0, y: 0, w: 30, h: 20 });
    expect(area('add')).toBeCloseTo(600, -1);
    expect(area('cut')).toBeCloseTo(200, -1);
    expect(area('intersect')).toBeCloseTo(200, -1);
    expect(area('exclude')).toBeCloseTo(400, -1);
    expect(itemsToPath([base, other('intersect')])!.box.w).toBeCloseTo(10, 1);
  });

  it('pieces wound either way still add up when saved as one shape', () => {
    const a = box('a', 0, 0, 20, 20);
    const b: UiPathItem = { id: 'b', contours: [reverseContour(rectContour(10, 0, 20, 20))] };
    const saved = itemsToPath([a, b])!;
    expect(saved.path.contours.every((c) => contourArea(c) > 0)).toBe(true);
    expect(filledArea(saved.path.contours, { x: 0, y: 0, w: 30, h: 20 })).toBeCloseTo(600, -1);
  });

  it('a drawing with more points than a shape may hold is simplified to fit', () => {
    const wiggly = (id: string, y: number): UiPathItem => ({
      id,
      contours: [{ closed: true, points: Array.from({ length: 120 }, (_, i) => ({ x: i, y: y + (i % 2) * 3 })).concat([{ x: 119, y: y + 8 }, { x: 0, y: y + 8 }]) }],
    });
    const items = Array.from({ length: 20 }, (_, i) => wiggly(`w${i}`, i * 12));
    const saved = itemsToPath(items)!;
    expect(saved.path.contours.reduce((n, c) => n + c.points.length, 0)).toBeLessThanOrEqual(MAX_PATH_POINTS);
  });
});

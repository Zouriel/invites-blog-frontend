import { describe, expect, it } from 'vitest';
import { pathFromSvg, SvgPathError } from './svg-path';

const signedArea = (pts: { x: number; y: number }[]) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0) / 2;

describe('SVG path data as a drawn shape', () => {
  it('reads lines, absolute and relative, into its own box from 0,0', () => {
    const p = pathFromSvg('M 10 20 L 110 20 l 0 50 H 10 Z');
    expect([p.width, p.height]).toEqual([100, 50]);
    expect(p.contours).toEqual([{ closed: true, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }]);
  });

  it('keeps curves as handles, boxed by the curve itself, and turns quadratic curves into cubic ones', () => {
    const p = pathFromSvg('M0 0 C 0 50 100 50 100 0');
    // The curve peaks at 37.5; its handles reach 50, outside the box, as in the shape editor.
    expect([p.width, p.height]).toEqual([100, 37.5]);
    expect(p.contours[0].points).toEqual([{ x: 0, y: 0, out: { x: 0, y: 50 } }, { x: 100, y: 0, in: { x: 100, y: 50 } }]);
    const q = pathFromSvg('M0 0 Q 50 75 100 0').contours[0].points;
    expect(q).toEqual(pathFromSvg('M0 0 C 33.333333 50 66.666667 50 100 0').contours[0].points);
  });

  it('continues smooth curves (S, T) by reflecting the last handle', () => {
    const p = pathFromSvg('M0 0 C 0 20 40 20 40 0 S 80 -20 80 0').contours[0].points;
    // The second curve's first handle mirrors the first curve's last one through the point they share.
    expect(p[1].out!.x - p[1].x).toBeCloseTo(p[1].x - p[1].in!.x);
    expect(p[1].out!.y - p[1].y).toBeCloseTo(p[1].y - p[1].in!.y);
  });

  it('turns an arc into curves that end where the arc does: a circle from two arcs', () => {
    const p = pathFromSvg('M 0 50 A 50 50 0 1 1 100 50 A 50 50 0 1 1 0 50 Z');
    expect([p.width, p.height]).toEqual([100, 100]);
    const pts = p.contours[0].points;
    expect(pts.length).toBe(4);
    // Every point sits on the circle.
    for (const pt of pts) expect(Math.hypot(pt.x - 50, pt.y - 50)).toBeCloseTo(50, 1);
    expect(p.contours[0].closed).toBe(true);
  });

  it('makes one outline inside another a hole, however it was drawn', () => {
    // Both squares drawn the same way round: the inner one is turned so the non-zero fill leaves it empty.
    const p = pathFromSvg('M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z');
    const [outer, inner] = p.contours.map((c) => signedArea(c.points));
    expect(Math.sign(outer)).toBe(-Math.sign(inner));
    // Two shapes side by side stay two shapes.
    const two = pathFromSvg('M0 0 H40 V40 H0 Z M60 0 H100 V40 H60 Z').contours.map((c) => Math.sign(signedArea(c.points)));
    expect(two[0]).toBe(two[1]);
  });

  it('says what is wrong with a path it cannot read', () => {
    expect(() => pathFromSvg('')).toThrow(SvgPathError);
    expect(() => pathFromSvg('10 10 L 20 20')).toThrow(/starts with a command/);
    expect(() => pathFromSvg('M0 0 L 10')).toThrow(/needs more numbers/);
    expect(() => pathFromSvg('M0 0 X 10 10')).toThrow(SvgPathError);
    expect(() => pathFromSvg('M0 0')).toThrow(/draws nothing/);
    expect(() => pathFromSvg('M0 0 ' + 'L1 1 '.repeat(30), 10)).toThrow(/a shape may have 10/);
  });
});

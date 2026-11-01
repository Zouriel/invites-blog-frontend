import { describe, expect, it } from 'vitest';
import { contributorsOf, masonryColumns, pinchedColumns, tileHeightRatio } from './gallery';

describe('photo gallery', () => {
  it('keeps each shape, crops only the extremes, and copes with an unknown size', () => {
    expect(tileHeightRatio(300, 400)).toBeCloseTo(4 / 3);
    expect(tileHeightRatio(1000, 100)).toBe(0.66);
    expect(tileHeightRatio(100, 1000)).toBe(1.5);
    expect(tileHeightRatio(0, 0)).toBe(1);
  });

  it('gives each picture to the shortest column', () => {
    expect(masonryColumns([1.5, 0.7, 0.7, 1], 2)).toEqual([[0], [1, 2, 3]]);
  });

  it('pinching apart makes pictures bigger, together fits more, within limits', () => {
    expect(pinchedColumns(2, true)).toBe(1);
    expect(pinchedColumns(1, true)).toBe(1);
    expect(pinchedColumns(2, false)).toBe(3);
    expect(pinchedColumns(5, false)).toBe(5);
  });

  it('lists contributors, most photos first, leaving out the unnamed', () => {
    expect(contributorsOf(['A', 'B', null, 'B', undefined, ''])).toEqual([
      { name: 'B', count: 2 },
      { name: 'A', count: 1 },
    ]);
  });
});

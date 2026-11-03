import { describe, expect, it } from 'vitest';
import { contributorsOf, tileHeightRatio } from './gallery';

describe('photo gallery', () => {
  it('keeps each shape, crops only the extremes, and copes with an unknown size', () => {
    expect(tileHeightRatio(300, 400)).toBeCloseTo(4 / 3);
    expect(tileHeightRatio(1000, 100)).toBe(0.66);
    expect(tileHeightRatio(100, 1000)).toBe(1.5);
    expect(tileHeightRatio(0, 0)).toBe(1);
  });

  it('lists contributors, most photos first, leaving out the unnamed', () => {
    expect(contributorsOf(['A', 'B', null, 'B', undefined, ''])).toEqual([
      { name: 'B', count: 2 },
      { name: 'A', count: 1 },
    ]);
  });
});

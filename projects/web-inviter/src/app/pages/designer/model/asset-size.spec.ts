import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene } from './scene';
import { shownSize } from './asset-size';

const base = (id: string, extra: Partial<DesignElement>): DesignElement => ({
  id, type: 'image', x: 0, y: 0, w: 100, h: 100, rotate: 0, scale: 1, opacity: 1, keyframes: [], ...extra,
});
const scene = (elements: DesignElement[]): DesignScene => ({
  schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], elements,
  assets: {
    photo: { kind: 'image', data: 'data:image/png;base64,AA', width: 2000, height: 1000 },
    art: { kind: 'svg', data: '<svg/>', width: 50, height: 50 },
  },
} as unknown as DesignScene);

describe('the largest size an asset is shown at', () => {
  it('measures a filled picture by the side that covers the box, a fitted one by the side that fits', () => {
    // 2000x1000 in a 100x100 box: Fill scales to 100 high (200 wide, cropped); Fit scales to 100 wide.
    expect(shownSize(scene([base('e', { image: { asset: 'photo', fit: 'cover', radius: 0 } })]), 'photo')).toEqual({ width: 200, height: 100 });
    expect(shownSize(scene([base('e', { image: { asset: 'photo', fit: 'contain', radius: 0 } })]), 'photo')).toEqual({ width: 100, height: 50 });
  });

  it('takes the biggest of every use, counting scale, keyframes, loops and groups', () => {
    const small = base('a', { image: { asset: 'photo', fit: 'contain', radius: 0 } });
    const zoomed = base('b', {
      image: { asset: 'photo', fit: 'contain', radius: 0 }, scale: 0.5,
      keyframes: [{ t: 0, scale: 0.5 }, { t: 1, scale: 2 }],
      loop: { frames: [{ t: 0.5, scale: 1.5 }], repeat: 2, alternate: false },
    });
    const group = base('g', { type: 'group', image: null, scale: 2, children: [zoomed] });
    // 100 wide x keyframe 2 x loop 1.5 x group 2.
    expect(shownSize(scene([small, group]), 'photo')).toEqual({ width: 600, height: 300 });
  });

  it('measures an illustration by its box', () => {
    expect(shownSize(scene([base('s', { type: 'svg', w: 120, h: 80, svg: { asset: 'art', fills: {} } })]), 'art')).toEqual({ width: 120, height: 80 });
  });

  it('is nothing when nothing shows the asset', () => {
    expect(shownSize(scene([]), 'photo')).toBeNull();
    expect(shownSize(scene([]), 'missing')).toBeNull();
  });
});

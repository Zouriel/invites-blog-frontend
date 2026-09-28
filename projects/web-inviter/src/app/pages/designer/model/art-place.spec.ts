import { describe, expect, it } from 'vitest';
import { placeArt } from './art-place';
import type { ArtImport, DesignScene } from './scene';
import { stateAt } from './scene-ops';

const scene: DesignScene = {
  schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], elements: [], assets: {},
};

const asset = (id: string) => ({ id, kind: 'svg' as const, data: '<svg/>', width: 100, height: 50, colors: [], name: id, bytes: 10 });

describe('placeArt', () => {
  it('puts still art down as one element, sized to fit and centred', () => {
    const art: ArtImport = {
      name: 'Rose', width: 100, height: 50, assets: [asset('a1')], layers: [{ asset: 'a1', frames: [] }],
      animated: false, seconds: 0, loops: 1, bytes: 10,
    };
    const { scene: next, element } = placeArt(scene, art, { x: 195, y: 500 });
    expect(next.assets['a1'].kind).toBe('svg');
    expect(element.type).toBe('svg');
    expect(element.svg?.asset).toBe('a1');
    expect([element.w, element.h]).toEqual([240, 120]);
    expect([element.x, element.y]).toEqual([75, 440]);
    expect(element.keyframes).toEqual([]);
    expect(element.track ?? null).toBeNull();
  });

  it('stacks layers in a group, scales motion to the element, and plays it while it crosses the screen', () => {
    const art: ArtImport = {
      name: 'Sun', width: 100, height: 50, assets: [asset('bg'), asset('rays')],
      layers: [
        { asset: 'bg', frames: [] },
        { asset: 'rays', name: 'rays', frames: [{ t: 0, dx: 0, dy: 0, rotate: 0, scale: 1, opacity: 1 }, { t: 1, dx: 10, dy: -5, rotate: 720, scale: 1.5, opacity: 0.5 }] },
      ],
      animated: true, seconds: 6, loops: 2, bytes: 20,
    };
    const { scene: next, element } = placeArt(scene, art, { x: 195, y: 1000 });
    expect(element.type).toBe('group');
    const [bg, rays] = element.children!;
    expect(bg.keyframes).toEqual([]);
    expect(rays.name).toBe('Sun · rays');
    expect([rays.x, rays.y, rays.w, rays.h]).toEqual([0, 0, 240, 120]);
    // Top at 940: from 96 (coming up past the bottom) to 1060 (gone past the top).
    expect(rays.track).toEqual({ start: 96, end: 1060 });
    expect(rays.keyframes[1]).toMatchObject({ x: 24, y: -12, rotate: 720, scale: 1.5, opacity: 0.5 });
    // Halfway through the track it's halfway through the motion — where it was placed, mid-screen.
    const withGroup = { ...next, elements: [element] };
    expect(stateAt(withGroup, rays, 578).rotate).toBeCloseTo(360, 0);
  });
});

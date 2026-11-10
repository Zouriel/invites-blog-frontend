import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesignElement, DesignScene } from './scene';
import { clipsToBox, flattenBlockers, moves, pictureElement, renderScene } from './group-picture';
import { pageSvg } from '../render/rasterize';
import { compile, normalizeScene } from '../render';

const base = (id: string, extra: Partial<DesignElement>): DesignElement => ({
  id, type: 'shape', x: 0, y: 0, w: 10, h: 10, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: '#c0392b', strokeWidth: 0, radius: 0 }, ...extra,
});
const style = { size: 20, weight: 400, align: 'center' as const, valign: 'middle' as const, lineHeight: 1.2, letterSpacing: 0 };
const scene = (elements: DesignElement[], extra: Partial<DesignScene> = {}): DesignScene => ({
  schema: 3, canvas: {}, theme: [{ key: 'accent', label: 'Accent', value: '#336699' }], fonts: [], roles: [], fields: [], elements, assets: {}, ...extra,
});
const group = (children: DesignElement[], extra: Partial<DesignElement> = {}) =>
  base('g', { type: 'group', x: 40, y: 300, w: 200, h: 100, shape: null, children, ...extra });

describe('turning a group into a picture', () => {
  it('takes still shapes, text, art and groups inside groups', () => {
    const g = group([
      base('a', { keyframes: [{ t: 0.4, x: 5 }] }), // one keyframe: it sits still
      base('b', { keyframes: [{ t: 0, x: 5, opacity: 0.5 }, { t: 1, opacity: 0.5 }] }), // the same all along
      base('t', { type: 'text', shape: null, text: { runs: [{ text: 'Mira & Ali' }], style } }),
      base('g2', { type: 'group', shape: null, children: [base('c', {})] }),
    ]);
    expect(flattenBlockers(scene([g]), g)).toEqual([]);
  });

  it('refuses what a still picture would change, saying what and why', () => {
    const g = group([
      base('m', { name: 'Petal', keyframes: [{ t: 0, y: 0 }, { t: 1, y: 40 }] }),
      base('f', { type: 'text', shape: null, text: { runs: [{ text: 'Dear ' }, { var: 'guest.name' }], style } }),
      base('r', { type: 'rsvp', shape: null, button: { label: 'Reply', strokeWidth: 0, radius: 8, style } }),
      base('x', { name: 'Glow', blend: 'screen' }),
    ]);
    const why = flattenBlockers(scene([g]), g);
    expect(why).toHaveLength(4);
    expect(why[0]).toBe('Petal moves on its own.');
    expect(why[1]).toMatch(/shows a field/);
    expect(why[2]).toMatch(/button guests tap/);
    expect(why[3]).toBe('Glow blends with what is under the group.');
    for (const child of [
      base('l', { loop: { frames: [{ t: 0.5, dy: 4 }], repeat: 2, alternate: true } }),
      base('p', { shape: { kind: 'rect', sides: 6, strokeWidth: 0, radius: 0, particles: { kind: 'snow' } } }),
      base('c', { type: 'countdown', shape: null }),
      base('s', { type: 'slot', shape: null }),
      base('k', { pinned: true }),
      base('o', { roleScope: 'bride' }),
      base('q', { tapScroll: 900 }),
      base('d', { keyframes: [{ t: 0, blur: 0 }, { t: 1, blur: 6 }] }), // a blur in
    ]) expect(flattenBlockers(scene([group([child])]), group([child])), child.id).toHaveLength(1);
    // On a stage, a piece with a bar of its own comes and goes.
    const windowed = group([base('w', { track: { start: 100, end: 400 } })]);
    expect(flattenBlockers(scene([windowed], { stage: true }), windowed)).toEqual([expect.stringMatching(/part of the page/)]);
    expect(flattenBlockers(scene([windowed]), windowed)).toEqual([]);
    expect(flattenBlockers(scene([]), base('n', {}))).toHaveLength(1);
  });

  it('only treats a mask or clip the page draws as cutting at the box', () => {
    expect(clipsToBox(group([], { mask: { kind: 'heart' } }))).toBe(true);
    expect(clipsToBox(group([], { clipShape: 'inset' }))).toBe(true);
    expect(clipsToBox(group([], { mask: { kind: 'nonsense' } }))).toBe(false);
    expect(clipsToBox(group([]))).toBe(false);
  });

  it('counts a change in any keyframe value, carried forward, as moving', () => {
    expect(moves(base('a', { keyframes: [{ t: 0, x: 1, rotateX: 10 }, { t: 1, x: 1 }] }))).toBe(false);
    expect(moves(base('a', { keyframes: [{ t: 0, x: 1 }, { t: 1, x: 1, clip: [10, 0, 0, 0] }] }))).toBe(true);
    expect(moves(base('a', { keyframes: [{ t: 1, x: 2 }, { t: 0, x: 1 }] }))).toBe(true);
  });

  it('keeps the box, place, motion and effects when nothing spills out', () => {
    const g = group([base('a', {})], {
      name: 'Crest', rotate: 8, scale: 1.2, opacity: 0.8, blend: 'multiply', pinned: true, track: { start: 0, end: 600 },
      keyframes: [{ t: 0, x: 40, y: 300 }, { t: 1, x: 90, rotate: 20 }], loop: { frames: [{ t: 0.5, dy: 6 }], repeat: 3, alternate: true },
      shadow: { x: 2, y: 4, blur: 8 }, mask: { kind: 'circle' }, origin: { x: 0.2, y: 0.9 }, gradient: { kind: 'linear', angle: 0, stops: [] } as never,
      recipe: { id: 'r', seed: 3 },
    });
    const p = pictureElement(g, 'pic1', { x: 0, y: 0, w: 200, h: 100 });
    expect(p.id).not.toBe('g');
    expect(p).toMatchObject({
      type: 'image', name: 'Crest', x: 40, y: 300, w: 200, h: 100, rotate: 8, scale: 1.2, opacity: 0.8, blend: 'multiply', pinned: true,
      track: g.track, keyframes: g.keyframes, loop: g.loop, shadow: g.shadow, mask: g.mask, origin: g.origin,
      image: { asset: 'pic1', fit: 'stretch', radius: 0 }, children: null, gradient: null,
    });
    expect(p.recipe).toBeUndefined();
  });

  it('grows the box to take in what spills past it, turning about the same point on the page', () => {
    const g = group([base('a', {})], { rotate: 30, scale: 2, keyframes: [{ t: 0, x: 40, y: 300 }, { t: 1, x: 140, rotate: 90 }, { t: 1, scale: 1 }] });
    const box = { x: -12.5, y: -4, w: 230, h: 120 };
    const p = pictureElement(g, 'pic1', box);
    expect([p.x, p.y, p.w, p.h]).toEqual([27.5, 296, 230, 120]);
    expect(p.keyframes.map((k) => [k.x, k.y])).toEqual([[27.5, 296], [127.5, undefined], [undefined, undefined]]);
    // The centre it turned and grew about, as a point on the page, at rest and at the keyframes that place it.
    const pairs: [number, number, number, number][] = [[g.x, g.y, p.x, p.y], [40, 300, p.keyframes[0].x!, p.keyframes[0].y!], [140, 300, p.keyframes[1].x!, p.keyframes[0].y!]];
    for (const [gx, gy, px, py] of pairs) {
      expect(px + p.origin!.x * p.w).toBeCloseTo(gx + 0.5 * g.w, 3);
      expect(py + p.origin!.y * p.h).toBeCloseTo(gy + 0.5 * g.h, 3);
    }
  });

  it('draws only what is inside, still, at the place asked, leaving the group\'s own look to the picture', () => {
    const g = group([
      base('a', { x: 10, y: 20, keyframes: [{ t: 0.3, x: 30, y: 25, rotate: 15, rotateY: 20 }] }),
      base('g2', { type: 'group', shape: null, x: 100, children: [base('c', { keyframes: [{ t: 0.5, opacity: 0.4 }] })] }),
    ], { rotate: 12, opacity: 0.5, shadow: { blur: 9 }, mask: { kind: 'heart' }, blend: 'screen', keyframes: [{ t: 0, x: 1 }, { t: 1, x: 300 }], pinned: true });
    const s = renderScene(scene([base('other', {}), g], { stage: true }), g, 70, 80);
    expect(s.stage).toBe(false);
    expect(s.elements).toHaveLength(1);
    const still = s.elements[0];
    expect(still).toMatchObject({ x: 70, y: 80, rotate: 0, scale: 1, opacity: 1, keyframes: [], pinned: false, blend: null, mask: null, shadow: null });
    // A still keyframe becomes where the piece sits; a 3D turn it holds stays as one keyframe.
    expect(still.children![0]).toMatchObject({ x: 30, y: 25, rotate: 15 });
    expect(still.children![0].keyframes).toEqual([{ t: 0, x: 30, y: 25, rotate: 15, rotateY: 20 }]);
    expect(still.children![1].children![0]).toMatchObject({ opacity: 0.4, keyframes: [] });
  });
});

describe('the page drawn as an SVG image', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is one well-formed SVG with the fonts written in, a unit at the scale asked and no page colour', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const g = group([base('t', { type: 'text', shape: null, text: { runs: [{ text: 'A & B <3' }], style: { ...style, font: 'f1' } } })]);
    const catalog = { fonts: [{ id: 'f1', name: 'Fancy', stack: '"Fancy", serif', weights: [400] }], variables: [], fontBaseUrl: '/assets/fonts/' } as never;
    const html = compile(normalizeScene(renderScene(scene([g], { theme: [{ key: 'bg', label: 'Bg', value: '#ffeeaa' }] }), g, 10, 10)), catalog, { fontBaseUrl: '/assets/fonts/' });
    const svg = await pageSvg(html, { width: 220, height: 120, scale: 3, resolveUrl: (u) => 'https://assets.example' + u });
    const xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(xml.documentElement.getAttribute('width')).toBe('660');
    expect(fetchMock).toHaveBeenCalledWith('https://assets.example/assets/fonts/f1-400.woff2');
    expect(svg).toContain('url("data:font/woff2;base64,AQID")');
    expect(svg).not.toContain('<script');
    expect(svg).toContain('A &amp; B &lt;3');
    expect(svg).toContain('viewBox="0 0 220 120"');
    expect(svg).toContain('--u:1px');
    expect(svg).not.toMatch(/:root\{/);
    expect(svg).not.toMatch(/(^|[}\s])html\{/);
    expect(svg).toContain('--ib-bg:#ffeeaa');
  });
});

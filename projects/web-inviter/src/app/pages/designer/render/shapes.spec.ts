import { describe, expect, it } from 'vitest';
import { EXTRA_SHAPE_KINDS, MASK_KINDS, amountOf, countOf, shapeD } from './shapes';
import { gradientCss, gradientSvg, resolveGradient } from './gradient';
import { compileDesign } from './compiler';
import { resolveLight } from './patterns';

const scene = (elements: unknown[]) => ({
  schema: 3, canvas: {}, theme: [{ key: 'accent', label: 'Accent', value: '#c0a060' }], fonts: [], roles: [], fields: [], elements,
  assets: { pic: { kind: 'image', data: 'data:image/png;base64,iVBORw0KGgo=' } },
});
const compile = (elements: unknown[]) => compileDesign(scene(elements), { fonts: [], variables: [], fieldTypes: [], linkPaths: [] } as never);

describe('ready-made shapes', () => {
  it('draws every kind (and every mask) as path data made of numbers only', () => {
    for (const kind of [...EXTRA_SHAPE_KINDS, ...MASK_KINDS]) {
      const d = shapeD(kind, 120, 80, 6, null, 8, 1);
      expect(d, kind).toMatch(/^M[MLHVCQTAZ0-9 .-]+Z$/);
    }
    expect(shapeD('blob', 10, 10, 6, null, 0)).toBeNull();
  });

  it('holds counts and settings in range', () => {
    expect(countOf('star', 99)).toBe(24);
    expect(countOf('wave', 0)).toBe(1);
    expect(amountOf('star', null)).toBe(0.5);
    expect(amountOf('star', 7)).toBe(1);
    expect(amountOf('frame', Number.NaN)).toBe(0.15);
    expect(shapeD('ellipse', 100, 100, 0, null, 0)).toBe('M0 50A50 50 0 1 1 100 50A50 50 0 1 1 0 50Z');
  });

  it('compiles a ready-made shape with a dashed outline', () => {
    const html = compile([{ id: 'a', type: 'shape', x: 0, y: 0, w: 100, h: 50, keyframes: [], shape: { kind: 'star', fill: '#123456', stroke: '#000', strokeWidth: 2, dash: 'dashed' } }]);
    expect(html).toMatch(/<path d="M[^"]+Z" fill-rule="evenodd" style="fill:#123456;stroke:#000;stroke-width:2;stroke-dasharray:6 4"\/>/);
  });
});

describe('gradients', () => {
  const resolve = (r: string | null) => (r === 'theme:accent' ? 'var(--ib-accent)' : r && r.startsWith('#') ? r : null);

  it('needs two colours that resolve, spaces them evenly and wraps the angle', () => {
    expect(resolveGradient({ type: null, angle: 90, stops: [{ color: '#000', at: null }, { color: 'nope', at: null }] }, resolve)).toBeNull();
    const g = resolveGradient({ type: 'conic', angle: -90, stops: [{ color: '#000', at: null }, { color: 'theme:accent', at: null }, { color: '#fff', at: 2 }] }, resolve)!;
    expect(g).toEqual({ type: 'linear', angle: 270, stops: [{ color: '#000', at: 0 }, { color: 'var(--ib-accent)', at: 0.5 }, { color: '#fff', at: 1 }] });
    expect(gradientCss(g)).toBe('linear-gradient(270deg,#000 0%,var(--ib-accent) 50%,#fff 100%)');
  });

  it('runs an SVG gradient corner to corner as CSS does', () => {
    const g = resolveGradient({ type: 'linear', angle: 90, stops: [{ color: '#000', at: null }, { color: '#fff', at: null }] }, resolve)!;
    expect(gradientSvg('g1', g, 200, 50)).toContain('x1="0" y1="25" x2="200" y2="25"');
  });
});

describe('text, masks and light', () => {
  it('bends text along an arc and keeps its fields as tspans', () => {
    const html = compile([{ id: 't', type: 'text', x: 0, y: 0, w: 300, h: 80, keyframes: [], text: { curve: 50, runs: [{ text: 'Hi ' }, { var: 'guest.name' }], style: { size: 20 } } }]);
    expect(html).toContain('<textPath href="#c0" startOffset="50%" text-anchor="middle">Hi ');
  });

  it('clips a picture to a shape with a wrapper inside its moving layer', () => {
    const html = compile([{ id: 'p', type: 'image', x: 0, y: 0, w: 100, h: 80, keyframes: [], mask: { kind: 'heart' }, image: { asset: 'pic' } }]);
    expect(html).toContain('<div class="a"><div class="m m0">');
    expect(html).toMatch(/\.m0\{position:relative;width:100%;height:100%;-webkit-mask:url\("data:image\/svg\+xml;base64,/);
  });

  it('treats the default light as no light, and turns a set one into an azimuth', () => {
    expect(resolveLight({ angle: 135, color: null }, '#ffffff')).toBeNull();
    expect(resolveLight({ angle: 45, color: null }, null)).toEqual({ azimuth: 315, colour: null });
    expect(resolveLight({ angle: 135, color: 'theme:accent' }, 'var(--ib-accent)')).toEqual({ azimuth: 225, colour: 'var(--ib-accent)' });
  });
});

import { describe, expect, it } from 'vitest';
import { BLEND_MODES, elementFilter, resolveBevel, resolveGlow } from './effects';
import { patternFilter, resolvePattern } from './patterns';
import { compileDesign } from './compiler';

describe('effects', () => {
  it('resolves only effects that draw, holding sizes and strengths in range', () => {
    expect(resolveBevel(null)).toBeNull();
    expect(resolveBevel({ style: null, size: 4, strength: 0 })).toBeNull();
    expect(resolveBevel({ style: 'pillow', size: 99, strength: 7 })).toEqual({ style: 'raised', size: 30, strength: 1 });
    expect(resolveBevel({ style: 'pressed', size: NaN, strength: NaN })).toEqual({ style: 'pressed', size: 4, strength: 0.7 });
    expect(resolveGlow({ size: 0.1, strength: 0.5, blend: 'sparkle' }, 'screen')).toEqual({ size: 1, strength: 0.5, blend: 'screen' });
    expect(resolveGlow({ size: 10, strength: -1, blend: null }, 'normal')).toBeNull();
    expect(BLEND_MODES).toHaveLength(16);
  });

  it('is nothing without effects, and exactly the pattern filter with a pattern alone', () => {
    const none = { pattern: null, bevel: null, inner: null, outer: null };
    expect(elementFilter('f0', none, 100, 40)).toBeNull();
    const p = resolvePattern({ kind: 'stars', mode: 'emboss', size: 1, strength: 0.5 })!;
    expect(elementFilter('f0', { ...none, pattern: { p, colour: null } }, 100, 40)).toBe(patternFilter('f0', p, 100, 40, null));
  });

  it('chains pattern, inner glow, bevel and outer glow, with room for the glow', () => {
    const p = resolvePattern({ kind: 'dots', mode: null, size: 1, strength: 0.5 })!;
    const f = elementFilter('f0', {
      pattern: { p, colour: null },
      bevel: resolveBevel({ style: 'raised', size: 4, strength: 0.7 }),
      inner: { g: resolveGlow({ size: 8, strength: 1, blend: 'overlay' }, 'screen')!, colour: '#fff' },
      outer: { g: resolveGlow({ size: 20, strength: 0.5, blend: null }, 'normal')!, colour: 'var(--ib-accent)' },
    }, 100, 40)!;
    const at = (s: string) => { const i = f.indexOf(s); expect(i, s).toBeGreaterThanOrEqual(0); return i; };
    expect(at('result="p"/>')).toBeLessThan(at('<feBlend in2="p" mode="overlay" result="ig"/>'));
    expect(at('result="ig"')).toBeLessThan(at('<feBlend in2="ig" mode="hard-light"/>'));
    expect(at('result="bv"')).toBeLessThan(at('<feMergeNode in="bv"/>'));
    expect(f).toContain('flood-color:var(--ib-accent)" flood-opacity="0.5"');
    expect(f.startsWith('<filter id="f0" x="-30%" y="-75%" width="160%" height="250%"')).toBe(true);
  });

  it('puts the blend on the element and paints the page where a blend can see it', () => {
    const scene = {
      schema: 3, stage: true, canvas: {}, theme: [{ key: 'bg', label: 'Background', value: '#fbf7ef' }], fonts: [], roles: [], fields: [], assets: {},
      elements: [{ id: 'a', type: 'shape', x: 0, y: 0, w: 50, h: 50, keyframes: [], blend: 'soft-light', outerGlow: { color: 'theme:bg' }, shape: { kind: 'rect', fill: '#123456' } }],
    };
    const html = compileDesign(scene, { fonts: [], variables: [] } as never);
    expect(html).toContain('mix-blend-mode:soft-light;');
    expect(html).toContain('.ib-page,.ib-stage{background:var(--ib-bg)}');
    expect(html).toContain('flood-color:var(--ib-bg)');
  });
});

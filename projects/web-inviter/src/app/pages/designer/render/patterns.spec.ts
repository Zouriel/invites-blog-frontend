import { describe, expect, it } from 'vitest';
import { PATTERN_KINDS, PATTERN_MODES, marksSvg, patternFilter, resolvePattern, shapeMarksSvg } from './patterns';

describe('patterns', () => {
  it('has at least ten patterns and five ways to apply them', () => {
    expect(PATTERN_KINDS.length).toBeGreaterThanOrEqual(10);
    expect([...PATTERN_MODES]).toEqual(['shade', 'shine', 'colour', 'emboss', 'engrave']);
  });

  it('resolves only drawable patterns, holding size and strength in range', () => {
    expect(resolvePattern(null)).toBeNull();
    expect(resolvePattern({ kind: 'plaid', mode: null, size: 1, strength: 0.5 })).toBeNull();
    expect(resolvePattern({ kind: 'dots', mode: null, size: 1, strength: 0 })).toBeNull();
    expect(resolvePattern({ kind: 'dots', mode: 'glow', size: 99, strength: 7 })).toEqual({ kind: 'dots', mode: 'shade', size: 4, strength: 1 });
    expect(resolvePattern({ kind: 'dots', mode: 'shine', size: NaN, strength: NaN })).toEqual({ kind: 'dots', mode: 'shine', size: 1, strength: 0.5 });
  });

  it('builds every kind in every way, with its marks as result m', () => {
    for (const kind of PATTERN_KINDS)
      for (const mode of PATTERN_MODES) {
        const f = patternFilter('f0', resolvePattern({ kind, mode, size: 1, strength: 0.5 })!, 100, 60, '#123456');
        expect(f.startsWith('<filter id="f0"')).toBe(true);
        expect(f).toContain('result="m"');
        expect(f.endsWith('</filter>')).toBe(true);
      }
  });

  it('paints the colour way in its colour, and the others in theirs', () => {
    const f = (mode: string) => patternFilter('f', resolvePattern({ kind: 'stripes', mode, size: 1, strength: 0.4 })!, 10, 10, 'var(--ib-accent)');
    expect(f('colour')).toContain('flood-color:var(--ib-accent)" flood-opacity="0.4"');
    expect(f('shine')).toContain('flood-color:#ffffff');
    expect(f('shade')).toContain('flood-color:#000000');
    expect(f('emboss')).toContain('surfaceScale="3"');
    expect(f('engrave')).toContain('surfaceScale="-3"');
  });

  it('draws a geometric pattern as a tiled SVG over the box, and a texture as noise', () => {
    const svg = shapeMarksSvg('stripes', 1, -5, -5, 110, 70);
    expect(svg).toContain('viewBox="-5 -5 110 70"');
    expect(svg).toContain('patternTransform="rotate(45)"');
    expect(marksSvg('clouds', 2, 0, 0, 50, 50)).toContain('baseFrequency="4.5e-3"');
    // The page draws a texture inline: no image.
    expect(patternFilter('f', resolvePattern({ kind: 'clouds', mode: 'shade', size: 1, strength: 0.5 })!, 10, 10, null)).not.toContain('feImage');
  });
});

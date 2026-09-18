import { describe, expect, it } from 'vitest';
import { blank, htmlEncode, num, slug, trim, u } from './css';
import { normalizeColor, sanitizeSvg } from './svg-sanitizer';

/** The .NET behaviours the server's output depends on, pinned down one by one. */
describe('render helpers match .NET', () => {
  it('rounds to three places with ties to even, and never writes -0', () => {
    expect(num(0.0005)).toBe('0');
    expect(num(0.0015)).toBe('0.002');
    expect(num(0.0025)).toBe('0.002');
    expect(num(1.5)).toBe('1.5');
    expect(num(2.5e-3)).toBe('0.002');
    expect(num(-0.0004)).toBe('0');
    expect(num(-12.3455)).toBe('-12.346');
    expect(num(0.1 + 0.2)).toBe('0.3');
    expect(num(123456.7894)).toBe('123456.789');
    expect(num(Number.NaN)).toBe('0');
    expect(num(Number.POSITIVE_INFINITY)).toBe('0');
    expect(num(100)).toBe('100');
  });

  it('writes lengths in canvas units, with a bare 0px for zero', () => {
    expect(u(0)).toBe('0px');
    expect(u(12.5)).toBe('calc(12.5 * var(--u))');
    expect(u(0.0001)).toBe('calc(0 * var(--u))');
  });

  it('encodes like WebUtility.HtmlEncode', () => {
    expect(htmlEncode(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(htmlEncode('café ©')).toBe('caf&#233; &#169;');
    expect(htmlEncode('’—')).toBe('’—');
    expect(htmlEncode('🎉')).toBe('&#127881;');
    expect(htmlEncode('\ud800x')).toBe('�x');
    expect(htmlEncode(null)).toBe('');
  });

  it('trims and blanks by .NET whitespace (NEL is space, BOM is not)', () => {
    expect(trim(' hi  ')).toBe('hi');
    expect(trim('﻿hi')).toBe('﻿hi');
    expect(blank(' \t')).toBe(true);
    expect(blank('﻿')).toBe(false);
  });

  it('slugs names and camel-cases keys', () => {
    expect(slug(' Bride’s Side ')).toBe('bride-s-side');
    expect(slug('---')).toBe('');
    expect(slug('bride photo', true)).toBe('bridePhoto');
    expect(slug('9lives', true)).toBe('9lives');
    expect(slug('a'.repeat(60)).length).toBe(40);
  });

  it('normalises SVG colours', () => {
    expect(normalizeColor('Gold')).toBe('#ffd700');
    expect(normalizeColor('#AbC')).toBe('#aabbcc');
    expect(normalizeColor('rgb(300, 0, 16)')).toBe('#ff0010');
    expect(normalizeColor('toString')).toBeNull();
  });

  it('sanitises an SVG down to drawing, with paints turned into theme slots', () => {
    const clean = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x()</script><rect fill="red" onclick="x()" width="10"/><!-- c --></svg>', 's0-');
    expect(clean.innerMarkup).toBe('<rect width="10" style="fill:var(--c0, #ff0000)"/>');
    expect(clean.colors).toEqual(['#ff0000']);
    expect(clean.viewBox).toBe('0 0 10 10');
  });
});

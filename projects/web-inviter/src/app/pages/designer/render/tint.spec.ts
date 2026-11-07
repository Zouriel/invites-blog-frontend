import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compile, normalizeScene, type RenderCatalog } from './index';
import { sanitizeSvg } from './svg-sanitizer';

/**
 * A tinted illustration in the browser renderer: the same cases as the server's DesignCompilerTests
 * ("Tinted illustrations"). Several fills, a stroke, an outline with fill="none", colours in a style
 * attribute, a gradient, a part in currentColor and one left at the default black.
 */
const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
  <rect width="50" height="50" fill="#112233"/>
  <circle cx="70" cy="70" r="10" fill="#445566" stroke="#778899"/>
  <path d="M0 0L100 100" fill="none" stroke="#aabbcc"/>
  <path d="M0 100L100 0" style="fill:#ddeeff;stroke:none"/>
  <rect x="60" width="40" height="20" fill="url(#g)"/>
  <path d="M10 90h5" fill="currentColor"/>
  <path d="M20 90h5"/>
</svg>`;

const FIXTURES = 'projects/web-inviter/src/app/pages/designer/render/testing/parity-fixtures.json.gz';
const fixtures = JSON.parse(gunzipSync(readFileSync(existsSync(FIXTURES) ? FIXTURES : FIXTURES.replace(/^projects\/web-inviter\//, ''))).toString('utf8'));
const catalog: RenderCatalog = fixtures.catalog;

/* eslint-disable @typescript-eslint/no-explicit-any */
function page(tint: string | undefined, fills: Record<string, string> = {}): string {
  const base = fixtures.cases.find((c: any) => c.published && c.name.includes('blank')) ?? fixtures.cases.find((c: any) => c.published);
  const scene: any = structuredClone(base.scene);
  scene.assets = { ...(scene.assets ?? {}), art: { kind: 'svg', data: ART, width: 100, height: 100 } };
  scene.elements = [...scene.elements, {
    id: 'art', type: 'svg', x: 20, y: 200, w: 100, h: 100,
    svg: { asset: 'art', fills, ...(tint === undefined ? {} : { tint }) },
    keyframes: [{ t: 0, opacity: 0 }, { t: 0.15, opacity: 1 }],
    loop: { repeat: 2, frames: [{ t: 0.5, dy: -10 }] },
  }];
  return compile(normalizeScene(scene), catalog, { fontBaseUrl: '/assets/fonts/' });
}

const tintRule = (html: string) => /\{(--c\d+:[^;{}]+;)+--cu:[^;{}]+;color:[^;{}]+;fill:[^;{}]+\}/.exec(html)?.[0] ?? null;

describe('tinted illustrations', () => {
  it('paints every colour of the art, gradients included, and leaves "none" alone', () => {
    expect(sanitizeSvg(ART).colors).toHaveLength(7);
    const html = page('#AA0000');
    expect(tintRule(html)).toBe('{' + [0, 1, 2, 3, 4, 5, 6].map((i) => `--c${i}:#aa0000;`).join('') + '--cu:#aa0000;color:#aa0000;fill:#aa0000}');
    // A gradient is painted through --cu, so the tint lays it flat.
    expect(html).toMatch(/fill:var\(--cu, url\(#s\d+-g\)\)/);
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke:none');
    // The art keeps its own colours underneath, so clearing the tint brings them back.
    expect(html).toContain('var(--c0, #ff0000)');
  });

  it('follows the theme when the tint is a theme colour', () => {
    const rule = tintRule(page('theme:accent'))!;
    expect(rule.startsWith('{--c0:var(--ib-accent);')).toBe(true);
    expect(rule.endsWith('color:var(--ib-accent);fill:var(--ib-accent)}')).toBe(true);
  });

  it('brings back the art and its own recolouring when cleared', () => {
    const html = page(undefined, { '#112233': '#00ff00' });
    expect(tintRule(html)).toBeNull();
    expect(html).toContain('{--c2:#00ff00;}');
    expect(page('#000000', { '#112233': '#00ff00' })).not.toContain('--c2:#00ff00');
  });

  it('changes only colour, so motion compiles as before', () => {
    const motion = (html: string) => html.split('}').filter((r) => r.includes('animation') || r.includes('@keyframes')).join('\n');
    expect(motion(page(undefined))).not.toBe('');
    expect(motion(page('theme:accent'))).toBe(motion(page(undefined)));
  });
});

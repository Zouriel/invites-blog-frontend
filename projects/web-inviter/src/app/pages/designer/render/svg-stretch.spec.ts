import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compile, normalizeScene, type RenderCatalog } from './index';

/** An illustration stretched to its box: the same output as the server's (DesignCompilerTests). */
const FIXTURES = 'projects/web-inviter/src/app/pages/designer/render/testing/parity-fixtures.json.gz';
const fixtures = JSON.parse(gunzipSync(readFileSync(existsSync(FIXTURES) ? FIXTURES : FIXTURES.replace(/^projects\/web-inviter\//, ''))).toString('utf8'));
const catalog: RenderCatalog = fixtures.catalog;

/* eslint-disable @typescript-eslint/no-explicit-any */
function page(stretch: boolean | undefined): string {
  const scene: any = structuredClone(fixtures.cases.find((c: any) => c.published && c.name.includes('blank')).scene);
  scene.assets = { art: { kind: 'svg', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" fill="#c0a060"/></svg>', width: 120, height: 40 } };
  scene.elements = [...scene.elements, { id: 'art', type: 'svg', x: 20, y: 200, w: 300, h: 200, svg: { asset: 'art', fills: {}, ...(stretch === undefined ? {} : { stretch }) } }];
  return compile(normalizeScene(scene), catalog, { fontBaseUrl: '/assets/fonts/' });
}

describe('stretched illustrations', () => {
  it('fill their box out of proportion when stretched', () => {
    expect(page(true)).toContain('<svg class="s" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true"><use href="#s0" width="120" height="40"/></svg>');
  });
  it('keep their shape otherwise, exactly as before', () => {
    for (const p of [page(undefined), page(false)]) {
      expect(p).toContain('<svg class="s" aria-hidden="true"><use href="#s0" width="100%" height="100%"/></svg>');
      expect(p).not.toContain('preserveAspectRatio="none" aria-hidden="true"><use');
    }
  });
});

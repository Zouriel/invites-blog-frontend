import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { canonicalHtml as canonical, compile, normalizeScene, renderPreview, type RenderCatalog, type SampleMode } from './index';

/**
 * The browser renderer against the server's. `testing/parity-fixtures.json.gz` holds what the C#
 * compiler made of a corpus of scenes — the starters, plus seeded random scenes that reach every
 * element type and awkward value (see `testing/make-corpus.mjs` and the backend's
 * `DesignParityExportTests`). Every published page must match byte for byte; every bound preview must
 * parse to the same document.
 *
 * <p>For a bigger run, point `DESIGN_PARITY_OUT` at a fresh export (see testing/README.md).</p>
 */

interface Preview { editor: boolean; sample: SampleMode; blocks: string[] | null; hidden: string[]; scroll: number; html: string; bytes: number }
interface Case { name: string; scene: unknown; error?: string; published?: string; previews?: Preview[] }
interface Fixtures { catalog: RenderCatalog & { fontBaseUrl: string }; cases: Case[] }

const FIXTURES = 'projects/web-inviter/src/app/pages/designer/render/testing/parity-fixtures.json.gz';

function load(): Fixtures {
  const override = process.env['DESIGN_PARITY_OUT'];
  if (override) return JSON.parse(readFileSync(override, 'utf8'));
  const path = existsSync(FIXTURES) ? FIXTURES : FIXTURES.replace(/^projects\/web-inviter\//, '');
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
}

/** Throws with the first place two strings part ways, which is what you need to fix it. */
function expectSame(ours: string, theirs: string, what: string): void {
  if (ours === theirs) return;
  let i = 0;
  while (i < ours.length && ours[i] === theirs[i]) i++;
  const at = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 120), i + 120));
  throw new Error(`${what} differs at ${i} (ours ${ours.length}, server ${theirs.length})\n  ours:   ${at(ours)}\n  server: ${at(theirs)}`);
}

const fixtures = load();
const catalog = fixtures.catalog;

describe('designer renderer parity with the server', () => {
  it('has a corpus to check', () => {
    expect(fixtures.cases.filter((c) => c.published).length).toBeGreaterThan(10);
  });

  for (const c of fixtures.cases) {
    if (c.error || c.published === undefined) continue;
    it(`${c.name}: published page is byte-identical`, () => {
      expectSame(compile(normalizeScene(c.scene), catalog, { fontBaseUrl: '/assets/fonts/' }), c.published!, 'published page');
    });
    it(`${c.name}: previews bind to the same document`, () => {
      for (const p of c.previews ?? []) {
        const ours = renderPreview(c.scene, catalog, {
          fontBaseUrl: catalog.fontBaseUrl, sample: p.sample, blocks: p.blocks, hidden: new Set(p.hidden), scroll: p.scroll, editor: p.editor,
        });
        expect(ours.bytes, `${c.name} bytes`).toBe(p.bytes);
        expectSame(canonical(ours.html), canonical(p.html), `${c.name} preview (${p.sample}${p.editor ? ', editor' : ''})`);
      }
    });
  }
});

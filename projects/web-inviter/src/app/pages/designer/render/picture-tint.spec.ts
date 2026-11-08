import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compile, normalizeScene, type RenderCatalog } from './index';

/** Tinted pictures in the browser renderer: the same cases as the server's PictureTintTests. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const MASK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const FIXTURES = 'projects/web-inviter/src/app/pages/designer/render/testing/parity-fixtures.json.gz';
const fixtures = JSON.parse(gunzipSync(readFileSync(existsSync(FIXTURES) ? FIXTURES : FIXTURES.replace(/^projects\/web-inviter\//, ''))).toString('utf8'));
const catalog: RenderCatalog = fixtures.catalog;

/* eslint-disable @typescript-eslint/no-explicit-any */
function page(asset: any, image: any, inGroup = false): string {
  const base = fixtures.cases.find((c: any) => c.published && c.name.includes('blank'));
  const scene: any = structuredClone(base.scene);
  scene.stage = false;
  scene.assets = { pic: { kind: 'image', width: 40, height: 40, ...asset } };
  const el = {
    id: 'pic', type: 'image', x: 40, y: 120, w: 200, h: 200, image: { asset: 'pic', ...image },
    keyframes: [{ t: 0, opacity: 0, scale: 1 }, { t: 0.2, opacity: 1 }, { t: 1, scale: 1.18 }],
    loop: { repeat: 2, frames: [{ t: 0.5, dy: -6 }] },
  };
  scene.elements = [...scene.elements, inGroup ? { id: 'grp', type: 'group', x: 0, y: 0, w: 390, h: 400, children: [el] } : el];
  return compile(normalizeScene(scene), catalog, { fontBaseUrl: '/assets/fonts/' });
}
const png = { data: PNG, alpha: true };
const jpg = (mask = true) => ({ data: JPG, alpha: false, ...(mask ? { mask: MASK } : {}) });
const rule = (html: string) => /\.e\d+ \.i0\{[^}]*\}/.exec(html)?.[0] ?? '';

describe('tinted pictures', () => {
  it('paints a png with see-through parts only where it has colour', () => {
    const html = page(png, { fit: 'contain', tint: '#AA0000' });
    expect(html).toContain(`.i0{--im:url("${PNG}");background-image:var(--im)}`);
    expect(html.split('data:image/png;base64,').length - 1).toBe(1);
    expect(rule(html).endsWith(';background-image:none;background-color:#aa0000;-webkit-mask:var(--im) center/contain no-repeat;mask:var(--im) center/contain no-repeat}')).toBe(true);
  });

  it('makes an opaque jpg a silhouette through its brightness mask', () => {
    const html = page(jpg(), { fit: 'cover', tint: '#AA0000' });
    expect(html).toContain(`.k0{--mk:url("${MASK}")}`);
    expect(html).toContain('<div class="i0 k0" role="presentation">');
    expect(rule(html).endsWith(';background-image:none;background-color:#aa0000;-webkit-mask:var(--mk) center/cover no-repeat;mask:var(--mk) center/cover no-repeat}')).toBe(true);
  });

  it('keeps an opaque jpg in overlay, with the colour multiplied over it and cut to the photo', () => {
    const html = page(jpg(), { fit: 'contain', tint: '#AA0000', tintMode: 'overlay' });
    expect(html).not.toContain('.k0{');
    expect(rule(html).endsWith(';background-color:#aa0000;background-blend-mode:multiply;-webkit-mask:var(--im) center/contain no-repeat;mask:var(--im) center/contain no-repeat}')).toBe(true);
    expect(rule(page(jpg(false), { tint: '#AA0000' }))).toContain('background-blend-mode:multiply');
  });

  it('follows the theme', () => {
    expect(rule(page(png, { tint: 'theme:accent' }))).toContain(';background-color:var(--ib-accent);');
  });

  it('compiles exactly as before tints once cleared', () => {
    const html = page(jpg(), { fit: 'cover', tint: null, tintMode: 'overlay' });
    expect(html).toContain(`.i0{background-image:url("${JPG}")}`);
    expect(html).not.toContain('--im');
    expect(rule(html)).toMatch(/^\.e\d+ \.i0\{width:100%;height:100%;background-repeat:no-repeat;background-position:center;background-size:cover\}$/);
  });

  it('tints a picture inside a group', () => {
    expect(rule(page(png, { tint: '#AA0000' }, true))).toContain('mask:var(--im)');
  });

  it('changes only the picture, so motion compiles as before', () => {
    const motion = (html: string) => html.split('}').filter((r) => r.includes('animation') || r.includes('@keyframes')).join('\n');
    expect(motion(page(png, {}))).not.toBe('');
    expect(motion(page(png, { tint: 'theme:accent' }))).toBe(motion(page(png, {})));
  });

  it('stretches a picture to its box when its fit is stretch, tinted or not', () => {
    expect(rule(page(png, { fit: 'stretch' }))).toMatch(/background-size:100% 100%\}$/);
    expect(rule(page(png, { fit: 'stretch', tint: '#AA0000' }))).toContain('mask:var(--im) center/100% 100% no-repeat');
  });
});

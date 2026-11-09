import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../shared/api/api.service';
import { DesignStore } from '../design.store';
import type { DesignCatalog, DesignElement, DesignScene } from '../model/scene';
import { findElement, flatten } from '../model/scene-ops';
import { generatedOf } from '../model/generators';
import { repeatOf } from '../model/repeat';
import { runTool, type ToolContext } from './assistant-tools';

const catalog = {
  canvas: { width: 390, referenceViewport: 844 }, fontBaseUrl: '/assets/fonts/', fonts: [], variables: [],
  enterPresets: [], exitPresets: [], loopPresets: [], easings: [], fieldTypes: [], linkPaths: [], starters: [], requiredThemeKeys: [],
  limits: { maxElements: 60 },
} as unknown as DesignCatalog;

const shape = (id: string, kind: 'rect' | 'ellipse', x: number, y: number, w: number, h: number): DesignElement => ({
  id, type: 'shape', name: null, x, y, w, h, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind, sides: 6, fill: '#000000', stroke: null, strokeWidth: 0, radius: 0 },
});

const scene = (elements: DesignElement[]): DesignScene => ({
  schema: 3, canvas: {}, theme: [{ key: 'bg', label: 'Background', value: '#ffffff' }, { key: 'accent', label: 'Accent', value: '#b08d57' }],
  fonts: [], roles: [], fields: [], elements, assets: {},
});

describe('assistant creation tools', () => {
  let store: DesignStore;
  let ctx: ToolContext;
  const run = (name: string, input: Record<string, unknown>) => runTool(ctx, name, input);
  const el = (id: string) => findElement(store.scene()!, id)!;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
    store.catalog.set(catalog);
    store.scene.set(scene([shape('petal', 'ellipse', 175, 100, 40, 100), shape('a', 'rect', 0, 400, 100, 100), shape('b', 'rect', 50, 400, 100, 100)]));
    ctx = { store, api: TestBed.inject(ApiService), checked: async () => undefined };
  });
  afterEach(() => vi.useRealTimers());

  it('repeat_element makes a flower of petals in one group, one undo step', async () => {
    const r = await run('repeat_element', { id: 'petal', layout: 'around', count: 8, ring: 'petals' });
    expect(r.ok).toBe(true);
    expect(r.summary).toBe('Repeated “Shape” around a circle');
    const group = store.scene()!.elements.find((e) => e.type === 'group')!;
    expect(r.text).toContain(group.id);
    expect(group.children).toHaveLength(8);
    expect(repeatOf(group)).toMatchObject({ kind: 'circle', count: 8, radius: 50, faceOut: true });
    expect(group.children!.map((c) => c.rotate)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    store.undo();
    expect(store.scene()!.elements.map((e) => e.id)).toEqual(['petal', 'a', 'b']);
  });

  it('repeat_element in a grid and a line, and says why when it can’t', async () => {
    expect((await run('repeat_element', { id: 'a', layout: 'grid', columns: 2, rows: 2, gap: 10 })).ok).toBe(true);
    const grid = store.scene()!.elements.find((e) => e.type === 'group')!;
    expect(grid.children!.map((c) => [c.x, c.y])).toEqual([[0, 0], [110, 0], [0, 110], [110, 110]]);
    expect((await run('repeat_element', { id: 'b', layout: 'line', count: 3, direction: 'down', gap: 0 })).ok).toBe(true);
    const r = await run('repeat_element', { id: 'petal', layout: 'grid', columns: 10, rows: 10 });
    expect(r.ok).toBe(false);
    expect(r.text).toContain('60 elements');
    expect((await run('repeat_element', { id: 'petal', layout: 'spiral' })).ok).toBe(false);
    expect((await run('repeat_element', { id: 'nope', layout: 'grid' })).text).toContain('No element');
  });

  it('generate makes a blob and a vine from a seed, in theme colours, where asked; scatter points to particles', async () => {
    const before = store.scene()!.elements.length;
    const s = await run('generate', { kind: 'scatter', shape: 'hearts', count: 12, seed: 5, at: 844 });
    expect(s.ok).toBe(false);
    expect(s.text).toContain('particles');
    expect(store.scene()!.elements).toHaveLength(before);

    expect((await run('generate', { kind: 'blob', style: 'wild', w: 300, color: '#ff00aa', x: 10, y: 20 })).ok).toBe(true);
    const blob = store.scene()!.elements.at(-1)!;
    expect(blob).toMatchObject({ type: 'shape', x: 10, y: 20 });
    expect(blob.shape).toMatchObject({ kind: 'path', fill: '#ff00aa' });
    expect(Math.max(blob.w, blob.h)).toBeCloseTo(300, 0);

    expect((await run('generate', { kind: 'vine', leaves: 6, curl: 'curly', direction: 'across', leaf_color: 'theme:accent' })).ok).toBe(true);
    const vine = store.scene()!.elements.at(-1)!;
    expect(vine.children).toHaveLength(7);
    expect(generatedOf(vine)!.options).toMatchObject({ kind: 'vine', curl: 0.9, direction: 'across', leafColor: 'theme:accent' });

    expect((await run('generate', { kind: 'confetti' })).ok).toBe(false);
    expect((await run('generate', { kind: 'blob', color: 'url(x)' })).ok).toBe(false);
  });

  it('combine_shapes makes one drawn shape, keeping the bottom one', async () => {
    const r = await run('combine_shapes', { ids: ['b', 'a'], op: 'cut' });
    expect(r.ok).toBe(true);
    expect(r.summary).toBe('Combined 2 shapes into one');
    expect(store.scene()!.elements.map((e) => e.id)).toEqual(['petal', 'a']);
    expect(el('a')).toMatchObject({ x: 0, w: 50, shape: { kind: 'path' } });
    store.undo();
    expect(store.scene()!.elements).toHaveLength(3);
    const bad = await run('combine_shapes', { ids: ['a'] });
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain('two or more');
    expect((await run('combine_shapes', { ids: ['a', 'b'], op: 'merge' })).ok).toBe(false);
    expect(flatten(store.scene()!)).toHaveLength(3);
  });
});

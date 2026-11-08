import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore } from './design.store';
import { flatten } from './model/scene-ops';
import type { DesignElement, DesignScene } from './model/scene';

const shape = (id: string, name?: string): DesignElement => ({
  id, name, type: 'shape', x: 0, y: 0, w: 100, h: 100, rotate: 0, scale: 1, opacity: 1,
  keyframes: [{ t: 0.5, opacity: 0.5 } as DesignElement['keyframes'][number]],
  shape: { kind: 'rect', sides: 6, fill: '#000', stroke: '#000', strokeWidth: 0, radius: 0 },
});
const scene = (elements: DesignElement[]): DesignScene =>
  ({ schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], elements, assets: {}, stage: true, length: 4000 }) as unknown as DesignScene;

/** Deleting in the designer says what went, with Undo, the way the form builder does. */
describe('DesignStore delete notices', () => {
  let store: DesignStore;
  let snackbar: UiSnackbarService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
    snackbar = TestBed.inject(UiSnackbarService);
    store.scene.set(scene([shape('a', 'Title'), shape('b')]));
  });
  afterEach(() => {
    snackbar.dismiss();
    vi.useRealTimers();
  });

  it('names what was deleted, and Undo brings it back', () => {
    store.remove(['a']);
    expect(store.scene()!.elements.map((e) => e.id)).toEqual(['b']);
    expect(snackbar.current()?.message).toBe('Deleted “Title”');
    expect(snackbar.current()?.action?.label).toBe('Undo');
    snackbar.act();
    expect(store.scene()!.elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(snackbar.current()).toBeNull();
  });

  it('counts several things', () => {
    store.remove(['a', 'b']);
    expect(snackbar.current()?.message).toBe('Deleted 2 things');
  });

  it('stays quiet when a removal is part of another edit', () => {
    store.remove(['a'], { quiet: true });
    expect(store.scene()!.elements.length).toBe(1);
    expect(snackbar.current()).toBeNull();
  });

  it('a deleted keyframe can be undone', () => {
    store.removeKeyframe('b', 0);
    expect(store.scene()!.elements[1].keyframes.length).toBe(0);
    expect(snackbar.current()?.message).toBe('Deleted a keyframe');
    snackbar.act();
    expect(store.scene()!.elements[1].keyframes.length).toBe(1);
  });
});

/** "Shrink to fit": the asset swapped for a smaller one sized for how big it's shown, as one undoable step. */
describe('DesignStore shrink to fit', () => {
  let store: DesignStore;
  let snackbar: UiSnackbarService;
  const big = 'data:image/png;base64,' + 'A'.repeat(400_000);
  const small = 'data:image/png;base64,' + 'B'.repeat(20_000);
  const shrinkDesignAsset = vi.fn();

  beforeEach(() => {
    shrinkDesignAsset.mockReset();
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: { shrinkDesignAsset } }] });
    store = TestBed.inject(DesignStore);
    snackbar = TestBed.inject(UiSnackbarService);
    const pic = (id: string, w: number): DesignElement => ({ ...shape(id), type: 'image', shape: null, w, h: w / 2, image: { asset: 'p1', fit: 'cover', radius: 0 } });
    store.scene.set({ ...scene([pic('a', 100), pic('b', 150)]), assets: { p1: { kind: 'image', data: big, width: 2000, height: 1000, name: 'beach' } } });
  });
  afterEach(() => snackbar.dismiss());

  it('asks for the biggest size it is shown at, swaps the file for every use, and Undo brings it back', async () => {
    const { of } = await import('rxjs');
    shrinkDesignAsset.mockReturnValue(of({ id: 'p1', kind: 'image', data: small, width: 300, height: 150, name: 'beach', bytes: 15000 }));
    await store.shrinkAsset('p1');
    expect(shrinkDesignAsset).toHaveBeenCalledWith({ id: 'p1', kind: 'image', data: big, width: 150, height: 75, name: 'beach' });
    expect(store.scene()!.assets['p1']).toEqual({ kind: 'image', data: small, width: 300, height: 150, name: 'beach' });
    expect(snackbar.current()?.title).toBe('Saved 371 KB');
    store.undo();
    expect(store.scene()!.assets['p1'].data).toBe(big);
  });

  it('says so when there is nothing to save, and changes nothing', async () => {
    const { of } = await import('rxjs');
    shrinkDesignAsset.mockReturnValue(of({ id: 'p1', kind: 'image', data: big, width: 0, height: 0, name: 'beach', bytes: 300000 }));
    await store.shrinkAsset('p1');
    expect(store.scene()!.assets['p1'].data).toBe(big);
    expect(store.canUndo()).toBe(false);
    expect(snackbar.current()?.title).toBe('Already as small as it can be');
  });
});

/** Tinting a picture from the panel: analysed the first time, one undoable step. */
describe('DesignStore picture tint', () => {
  let store: DesignStore;
  const analyseDesignImage = vi.fn();

  beforeEach(() => {
    analyseDesignImage.mockReset();
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: { analyseDesignImage } }] });
    store = TestBed.inject(DesignStore);
    const pic: DesignElement = { ...shape('p'), type: 'image', shape: null, image: { asset: 'a', fit: 'contain', radius: 0 } };
    store.scene.set({ ...scene([pic]), assets: { a: { kind: 'image', data: 'data:image/jpeg;base64,AAAA', width: 10, height: 10 } } });
  });

  it('sets the tint and what it needs as one step, and Undo takes both back', async () => {
    const { of } = await import('rxjs');
    analyseDesignImage.mockReturnValue(of({ alpha: false, mask: 'data:image/png;base64,TUFTSw==' }));
    await store.tintPicture('p', '#aa0000');
    expect(store.scene()!.elements[0].image).toEqual({ asset: 'a', fit: 'contain', radius: 0, tint: '#aa0000' });
    expect(store.scene()!.assets['a']).toMatchObject({ alpha: false, mask: 'data:image/png;base64,TUFTSw==' });
    await store.tintPicture('p', '#aa0000', 'overlay');
    expect(store.scene()!.elements[0].image!.tintMode).toBe('overlay');
    expect(analyseDesignImage).toHaveBeenCalledTimes(1);
    await store.tintPicture('p', null);
    expect(store.scene()!.elements[0].image).toEqual({ asset: 'a', fit: 'contain', radius: 0 });
    store.undo();
    store.undo();
    store.undo();
    expect(store.scene()!.elements[0].image).toEqual({ asset: 'a', fit: 'contain', radius: 0 });
    expect(store.scene()!.assets['a'].mask).toBeUndefined();
  });
});

/** Dragging a group's corner on the canvas: what is in it grows with it. */
describe('DesignStore group resize', () => {
  it('scales a group\'s children when the group is given a new size', () => {
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    const store = TestBed.inject(DesignStore);
    const child: DesignElement = { ...shape('c'), keyframes: [], x: 10, y: 10, w: 30, h: 20 };
    store.scene.set(scene([{ ...shape('g'), type: 'group', shape: null, keyframes: [], x: 0, y: 0, w: 100, h: 100, children: [child] }]));
    store.place('g', { x: 0, y: 0 }, { w: 200, h: 200 });
    const g = store.scene()!.elements[0];
    expect([g.w, g.h]).toEqual([200, 200]);
    expect(g.children![0]).toMatchObject({ x: 20, y: 20, w: 60, h: 40 });
  });
});

/** Tint all / Reset on a group: every picture and illustration inside, nested ones too, as one step. */
describe('DesignStore group tint', () => {
  it('tints everything in a group once, analysing each picture once, and Undo takes it all back', async () => {
    const analyseDesignImage = vi.fn();
    const { of } = await import('rxjs');
    analyseDesignImage.mockReturnValue(of({ alpha: true, mask: null }));
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: { analyseDesignImage } }] });
    const store = TestBed.inject(DesignStore);
    const pic = (id: string): DesignElement => ({ ...shape(id), keyframes: [], type: 'image', shape: null, image: { asset: 'lace', fit: 'contain', radius: 0 } });
    const art: DesignElement = { ...shape('art'), keyframes: [], type: 'svg', shape: null, svg: { asset: 'ring', fills: {} } };
    const inner: DesignElement = { ...shape('inner'), keyframes: [], type: 'group', shape: null, children: [pic('p1'), pic('p2')] };
    const outer: DesignElement = { ...shape('outer'), keyframes: [], type: 'group', shape: null, children: [inner, art, shape('box')] };
    store.scene.set({ ...scene([outer]), assets: { lace: { kind: 'image', data: 'data:image/png;base64,AA', width: 1, height: 1 }, ring: { kind: 'svg', data: '<svg/>', width: 1, height: 1 } } });

    await store.tintGroup('outer', '#ffffff');
    const find = (id: string) => flatten(store.scene()!).find((f) => f.element.id === id)!.element;
    expect([find('p1').image!.tint, find('p2').image!.tint, find('art').svg!.tint]).toEqual(['#ffffff', '#ffffff', '#ffffff']);
    expect(find('box').shape).toEqual(shape('box').shape); // shapes keep their own colours
    expect(analyseDesignImage).toHaveBeenCalledTimes(1);
    expect(store.scene()!.assets['lace'].alpha).toBe(true);

    await store.tintGroup('outer', null);
    expect(find('p1').image!.tint).toBeUndefined();
    store.undo();
    expect(find('p1').image!.tint).toBe('#ffffff');
    store.undo();
    expect(find('p1').image!.tint).toBeUndefined();
  });
});

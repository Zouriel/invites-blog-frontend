import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore } from './design.store';
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

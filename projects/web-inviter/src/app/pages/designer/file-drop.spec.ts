import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore, isArtFile } from './design.store';
import type { ArtImport, DesignScene } from './model/scene';

const scene = (): DesignScene => ({
  schema: 3, canvas: {}, fonts: [], roles: [], fields: [], elements: [], assets: {}, stage: true, length: 4000,
  theme: [{ key: 'accent', label: 'Accent', value: '#b08d57' }],
}) as unknown as DesignScene;

const art = (name: string, id: string): ArtImport => ({
  name, width: 100, height: 80, animated: false, seconds: 0, loops: 1, bytes: 10,
  assets: [{ id, kind: 'svg', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"/>', width: 100, height: 80, name, bytes: 10 }],
  layers: [{ asset: id, frames: [] }],
});

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('files dropped from the computer', () => {
  let store: DesignStore;
  let snackbar: UiSnackbarService;
  const uploadArt = vi.fn();

  beforeEach(() => {
    uploadArt.mockReset();
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: { uploadArt } }] });
    store = TestBed.inject(DesignStore);
    snackbar = TestBed.inject(UiSnackbarService);
    store.scene.set(scene());
  });
  afterEach(() => snackbar.dismiss());

  it('takes SVG and the picture types, by type or by name when the computer gives none', () => {
    expect(isArtFile(file('flower.svg', 'image/svg+xml'))).toBe(true);
    expect(isArtFile(file('photo.jpg', 'image/jpeg'))).toBe(true);
    expect(isArtFile(file('sticker.webp', 'image/webp'))).toBe(true);
    expect(isArtFile(file('lace.svg', ''))).toBe(true);
    expect(isArtFile(file('notes.pdf', 'application/pdf'))).toBe(false);
    expect(isArtFile(file('photo.heic', 'image/heic'))).toBe(false);
  });

  it('adds every file dropped, each a little offset from the last, where it was dropped', async () => {
    uploadArt.mockImplementation((f: File) => of(art(f.name, 'a' + f.name.length)));
    const added = await store.importFiles([file('rose.svg', 'image/svg+xml'), file('leaf-two.svg', 'image/svg+xml')], { x: 200, y: 300 });
    expect(added).toBe(2);
    expect(uploadArt).toHaveBeenCalledTimes(2);
    const [first, second] = store.scene()!.elements;
    expect(store.scene()!.elements).toHaveLength(2);
    // Centred on the drop point, the second 24 units further on.
    expect(first.x + first.w / 2).toBeCloseTo(200, 0);
    expect(second.x - first.x).toBeCloseTo(24, 0);
    expect(second.y - first.y).toBeCloseTo(24, 0);
  });

  it('says which files it can’t take, and still adds the rest', async () => {
    uploadArt.mockImplementation((f: File) => of(art(f.name, 'b1')));
    const added = await store.importFiles([file('notes.pdf', 'application/pdf'), file('rose.svg', 'image/svg+xml')]);
    expect(added).toBe(1);
    expect(uploadArt).toHaveBeenCalledTimes(1);
    expect(store.scene()!.elements).toHaveLength(1);
    expect(snackbar.current()?.title ?? snackbar.current()?.message).toContain('notes.pdf');
  });

  it('a file the server refuses is skipped without stopping the others', async () => {
    uploadArt.mockImplementationOnce(() => throwError(() => new Error('too big'))).mockImplementationOnce((f: File) => of(art(f.name, 'c1')));
    expect(await store.importFiles([file('huge.png', 'image/png'), file('ok.png', 'image/png')])).toBe(1);
    expect(store.scene()!.elements).toHaveLength(1);
  });
});

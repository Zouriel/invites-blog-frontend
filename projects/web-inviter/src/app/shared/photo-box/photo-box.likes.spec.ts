import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

const photo = (id: string, extra: Partial<EventPhoto> = {}): EventPhoto => ({
  id, url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}-t.jpg`, originalUrl: `https://x/${id}-o.jpg`, contentType: 'image/jpeg',
  width: 100, height: 100, uploaderName: 'Mariyam', canDelete: false, createdAt: '2026-11-01T10:00:00Z', uploaderUserId: 'u-2',
  favouriteCount: 0, favourited: false, ...extra,
});

type Box = {
  setLiked: (p: EventPhoto, liked: boolean) => void;
  photos: () => EventPhoto[];
  filterSections: () => { id: string; options: { id: string }[] }[];
  selectionActions: () => { id: string }[];
  selected: { set: (v: Set<string>) => void };
  unfavouriteSelected: () => void;
};

function mount(as: 'host' | 'favourites', photos: EventPhoto[], signedIn = true) {
  const api = {
    campaignPhotos: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: photos.length, canUpload: false, photos })),
    myFavourites: vi.fn(() => of({ items: photos, totalCount: photos.length, page: 1, pageSize: 200 })),
    favourite: vi.fn(() => of({ favouriteCount: 5, favourited: true })),
    unfavourite: vi.fn(() => of({ favouriteCount: 0, favourited: false })),
  };
  const toast = { success: vi.fn(), danger: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: toast },
      { provide: SessionStore, useValue: { isSignedIn: signal(signedIn), account: signal({ id: 'me-1' }) } },
    ],
  });
  const fixture = TestBed.createComponent(PhotoBoxComponent);
  fixture.componentRef.setInput('campaignId', as === 'host' ? 'camp-1' : '');
  fixture.componentRef.setInput('as', as);
  fixture.detectChanges();
  return { fixture, api, toast, box: fixture.componentInstance as unknown as Box };
}

describe('photo box: hearts', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the count on a tile, and turns on double tap only for someone signed in', async () => {
    const { fixture } = mount('host', [photo('a', { favouriteCount: 3 }), photo('b')]);
    await fixture.whenStable();
    fixture.detectChanges();
    const counts = [...fixture.nativeElement.querySelectorAll('ui-like-count')] as HTMLElement[];
    expect(counts.map((c) => c.textContent?.trim())).toEqual(['3', '']);
    TestBed.resetTestingModule();
    const guest = mount('host', [photo('a', { favouriteCount: 3 })], false);
    await guest.fixture.whenStable();
    expect((guest.box as unknown as { canLike: () => boolean }).canLike()).toBe(false);
  });

  it('hearts at once, takes the server count, and undoes it when the server refuses', () => {
    const { box, api, toast } = mount('host', [photo('a', { favouriteCount: 4 })]);
    box.setLiked(box.photos()[0], true);
    expect(api.favourite).toHaveBeenCalledWith('a');
    expect(box.photos()[0]).toMatchObject({ favourited: true, favouriteCount: 5 });

    api.unfavourite.mockReturnValueOnce(throwError(() => new Error('no')));
    box.setLiked(box.photos()[0], false);
    expect(box.photos()[0]).toMatchObject({ favourited: true, favouriteCount: 5 });
    expect(toast.danger).toHaveBeenCalled();
  });

  it('Favourites: loads every page, filters by event or album, and removes the chosen from favourites', async () => {
    const items = [
      photo('a', { albumTitle: "Maya's birthday", favourited: true, favouriteCount: 2 }),
      photo('b', { albumTitle: 'Beach day', favourited: true, favouriteCount: 1 }),
    ];
    const { box, api, fixture, toast } = mount('favourites', items);
    await new Promise((r) => setTimeout(r));
    expect(api.myFavourites).toHaveBeenCalled();
    expect(box.photos().map((p) => p.id)).toEqual(['a', 'b']);
    const where = box.filterSections().find((s) => s.id === 'where');
    expect(where?.options.map((o) => o.id).sort()).toEqual(['Beach day', "Maya's birthday"]);
    expect(box.selectionActions().map((a) => a.id)).toContain('unfavourite');
    expect(box.selectionActions().map((a) => a.id)).not.toContain('remove');

    box.selected.set(new Set(['a']));
    box.unfavouriteSelected();
    await Promise.resolve();
    await Promise.resolve();
    expect(api.unfavourite).toHaveBeenCalledWith('a');
    expect(box.photos().map((p) => p.id)).toEqual(['b']);
    expect(toast.success).toHaveBeenCalledWith('Removed from your favourites.');
  });

  it('the open item has its heart and count in the viewer, inside the bottom bar', async () => {
    const { fixture, box } = mount('host', [photo('a', { favouriteCount: 3, favourited: true })]);
    await fixture.whenStable();
    (box as unknown as { view: (p: EventPhoto) => void }).view(box.photos()[0]);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('ui-media-lightbox .bar--bottom ui-like-button button') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-pressed')).toBe('true');
    expect(button!.textContent?.trim()).toBe('3');
  });

  it('Favourites with nothing yet says where they come from', async () => {
    const { fixture } = mount('favourites', []);
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your favourites will show here');
  });
});

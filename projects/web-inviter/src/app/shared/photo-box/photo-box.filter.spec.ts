import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import type { UiFilterValue } from '@zouriel/ui/filter';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

const photo = (id: string, who: string, video = false): EventPhoto => ({
  id, url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}-t.jpg`, originalUrl: `https://x/${id}-o.jpg`,
  contentType: video ? 'video/mp4' : 'image/jpeg', width: 100, height: 100, uploaderName: who, canDelete: false,
  createdAt: '2026-11-01T10:00:00Z', uploaderUserId: `u-${who}`,
});
const album = [photo('a1', 'Aisha'), photo('a2', 'Aisha', true), photo('b1', 'Ali'), photo('b2', 'Ali'), photo('c1', 'Shaina', true)];

type Box = {
  setFilter: (v: UiFilterValue) => void;
  downloadAll: () => void;
  selectAll: () => void;
  startSelecting: () => void;
  shown: () => EventPhoto[];
  items: () => unknown[];
  selected: () => ReadonlySet<string>;
  downloadLabel: () => string;
};

function mount() {
  const api = {
    mediaBucketMedia: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: album.length, canUpload: false, photos: album })),
    eventPhotosDownloadLink: vi.fn(() => of({ url: 'https://invites.blog/api/photos/archives/abc', name: 'x.zip', count: 2, bytes: 1024 })),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
      { provide: SessionStore, useValue: { isStudio: signal(false), isSignedIn: signal(true), account: signal({ id: 'me-1' }) } },
    ],
  });
  const fixture = TestBed.createComponent(PhotoBoxComponent);
  fixture.componentRef.setInput('campaignId', 'bucket-1');
  fixture.componentRef.setInput('as', 'bucket');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, api, el, box: fixture.componentInstance as unknown as Box };
}

describe('photo box: filter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('has one Filter button and no row of people buttons', () => {
    const { el } = mount();
    expect(el.querySelectorAll('ui-filter-button')).toHaveLength(1);
    const words = [...el.querySelectorAll('ui-button')].map((b) => b.textContent!.trim());
    expect(words.some((w) => /\(\d+\)$/.test(w))).toBe(false);
  });

  it('shows chips, narrows the grid, viewer and Select all, and downloads only what is shown', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { fixture, el, api, box } = mount();
    box.setFilter({ who: ['Ali', 'Shaina'] });
    fixture.detectChanges();
    expect([...el.querySelectorAll('ui-filter-chips ui-chip')].map((c) => c.textContent!.trim())).toEqual(['Ali', 'Shaina']);
    expect(box.shown().map((p) => p.id)).toEqual(['b1', 'b2', 'c1']);
    // The viewer swipes through the filtered set only.
    expect(box.items()).toHaveLength(3);
    box.startSelecting();
    box.selectAll();
    expect([...box.selected()]).toEqual(['b1', 'b2', 'c1']);
    // Narrowing further keeps only the chosen photos still on screen.
    box.setFilter({ who: ['Ali', 'Shaina'], kind: ['video'] });
    expect([...box.selected()]).toEqual(['c1']);
    expect(box.downloadLabel()).toBe('Download this 1');
    box.setFilter({ who: ['Ali'] });
    expect(box.downloadLabel()).toBe('Download these 2');
    box.downloadAll();
    const ids = (api.eventPhotosDownloadLink.mock.calls[0] as unknown as [string, string, string[]])[2];
    expect(ids).toEqual(['b1', 'b2']);
    box.setFilter({});
    expect(box.downloadLabel()).toBe('Download all');
  });

  it('says what is filtered when nothing matches, and offers Clear filters', () => {
    const { fixture, el, box } = mount();
    box.setFilter({ who: ['Ali'], kind: ['video'] });
    fixture.detectChanges();
    const empty = el.querySelector('ui-empty-state')!;
    expect(empty.textContent).toContain('Nothing matches these filters');
    expect(empty.textContent).toContain('Showing only Ali and Videos.');
    expect(el.querySelector('ui-masonry-grid')).toBeNull();
    const clear = [...empty.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Clear filters')!;
    clear.click();
    fixture.detectChanges();
    expect(box.shown()).toHaveLength(5);
    expect(el.querySelector('ui-masonry-grid')).not.toBeNull();
  });
});

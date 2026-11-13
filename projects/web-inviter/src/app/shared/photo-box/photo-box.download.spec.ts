import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

const photo = (id: string): EventPhoto => ({
  id, url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}-t.jpg`, originalUrl: `https://x/${id}-o.jpg`, contentType: 'image/jpeg',
  width: 100, height: 100, uploaderName: 'Mariyam', canDelete: false, createdAt: '2026-11-01T10:00:00Z', uploaderUserId: 'u-2',
});

/** An album of 1,500: the size that broke Download all when every id went in the query string. */
const album = Array.from({ length: 1500 }, (_, i) => photo(`p-${i}`));

async function mount() {
  const api = {
    // The viewer may take the whole album (their Premium, or the event's pass): the server says so on the album.
    mediaBucketMedia: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: album.length, canUpload: false, photos: album, downloadAll: true })),
    eventPhotosDownloadLink: vi.fn(() => of({ url: 'https://invites.blog/api/photos/archives/abc', name: 'Gala-photos.zip', count: 1500, bytes: 9.7 * 1024 ** 3 })),
  };
  const toast = { success: vi.fn(), danger: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: toast },
      { provide: SessionStore, useValue: { isStudio: signal(false), hasPortfolio: signal(false), isPhotographer: signal(false), isSignedIn: signal(true), account: signal({ id: 'me-1' }) } },
    ],
  });
  const fixture = TestBed.createComponent(PhotoBoxComponent);
  fixture.componentRef.setInput('campaignId', 'bucket-1');
  fixture.componentRef.setInput('as', 'bucket');
  fixture.detectChanges();
  return { fixture, api, toast, box: fixture.componentInstance as unknown as { downloadAll: () => void } };
}

describe('photo box: Download all on a large album', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names every photo in a request body and lets the browser save the zip from the link', async () => {
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.href);
    });
    const { api, toast, box } = await mount();

    box.downloadAll();

    // The album's own campaign, as the host, with all 1,500 ids: in a body, not a URL.
    expect(api.eventPhotosDownloadLink).toHaveBeenCalledTimes(1);
    const [campaign, as, ids] = api.eventPhotosDownloadLink.mock.calls[0] as unknown as [string, string, string[]];
    expect([campaign, as, ids.length]).toEqual(['camp-1', 'host', 1500]);
    // The browser navigates to the link itself: no blob of the archive is ever made.
    expect(clicked).toEqual(['https://invites.blog/api/photos/archives/abc']);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('1500 photos (9.7 GB)'));
    // 1,500 tiles take a while to render in jsdom.
  }, 30_000);
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { Account, EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

/** docs/PRICING-2026-11.md §2: at most 10 at a time unless the account or the album allows Download all. */
const photo = (id: string): EventPhoto => ({
  id, url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}-t.jpg`, originalUrl: `https://x/${id}-o.jpg`, contentType: 'image/jpeg',
  width: 100, height: 100, uploaderName: 'Mariyam', canDelete: false, createdAt: '2026-11-01T10:00:00Z', uploaderUserId: 'u-2',
});
const album = Array.from({ length: 14 }, (_, i) => photo(`p-${i}`));

type Box = {
  downloadAll(): void;
  selectAll(): void;
  toggleSelected(p: EventPhoto): void;
  startSelecting(): void;
  onSelectionAction(id: string): void;
  selected: () => ReadonlySet<string>;
  offerOpen: () => boolean;
  canSelectAll: () => boolean;
};

async function mount(opts: { downloadAll?: boolean; account?: Partial<Account>; linkError?: unknown } = {}) {
  const api = {
    campaignPhotos: vi.fn(() =>
      of({ campaignId: 'camp-1', eventTitle: 'Gala', count: album.length, canUpload: false, photos: album, downloadAll: opts.downloadAll, downloadLimit: 10 }),
    ),
    eventPhotosDownloadLink: vi.fn(() =>
      opts.linkError ? throwError(() => opts.linkError) : of({ url: 'https://invites.blog/api/photos/archives/abc', name: 'Gala.zip', count: 3, bytes: 1024 }),
    ),
  };
  const toast = { success: vi.fn(), danger: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: toast },
      {
        provide: SessionStore,
        useValue: { isSignedIn: signal(true), isPremium: signal(false), isStudio: signal(false), hasPortfolio: signal(false), isPhotographer: signal(false), account: signal({ id: 'me-1', ...(opts.account ?? {}) }) },
      },
    ],
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const fixture = TestBed.createComponent(PhotoBoxComponent);
  fixture.componentRef.setInput('campaignId', 'camp-1');
  fixture.componentRef.setInput('as', 'host');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, api, toast, box: fixture.componentInstance as unknown as Box };
}

describe('photo box: 10 at a time without Download all', () => {
  afterEach(() => vi.restoreAllMocks());

  it('picks up to 10; the 11th opens the Premium offer instead of being picked', async () => {
    const { box, fixture } = await mount({ downloadAll: false });
    box.startSelecting();
    for (const p of album.slice(0, 10)) box.toggleSelected(p);
    expect(box.selected().size).toBe(10);
    expect(box.offerOpen()).toBe(false);

    box.toggleSelected(album[10]);
    expect(box.selected().size).toBe(10);
    expect(box.offerOpen()).toBe(true);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Download more than 10 at once with Premium');
    // Un-picking one still works, and frees a place.
    box.toggleSelected(album[0]);
    box.toggleSelected(album[10]);
    expect(box.selected().has(album[10].id)).toBe(true);
  });

  it('has no Select all past the limit, and Download all opens the offer without asking the server', async () => {
    const { box, api } = await mount({ downloadAll: false });
    expect(box.canSelectAll()).toBe(false);
    box.selectAll();
    expect(box.selected().size).toBe(0);
    box.downloadAll();
    expect(api.eventPhotosDownloadLink).not.toHaveBeenCalled();
    expect(box.offerOpen()).toBe(true);
  });

  it("opens the offer on the server's download_limit refusal, not a red error", async () => {
    const refusal = Object.assign(new Error('Download more than 10 at once with Premium.'), {
      status: 403,
      errors: [{ message: 'Download more than 10 at once with Premium.', field: null, code: 'download_limit' }],
    });
    const { box, toast } = await mount({ downloadAll: false, linkError: refusal });
    box.startSelecting();
    for (const p of album.slice(0, 3)) box.toggleSelected(p);
    box.onSelectionAction('download');
    expect(box.offerOpen()).toBe(true);
    expect(toast.danger).not.toHaveBeenCalled();
  });

  it('downloads up to 10 chosen ones without Premium', async () => {
    const { box, api } = await mount({ downloadAll: false });
    box.startSelecting();
    for (const p of album.slice(0, 3)) box.toggleSelected(p);
    box.onSelectionAction('download');
    expect(api.eventPhotosDownloadLink).toHaveBeenCalledWith('camp-1', 'host', ['p-0', 'p-1', 'p-2']);
    expect(box.offerOpen()).toBe(false);
  });

  it('an album that allows it (the viewer’s Premium, or a Gold or Platinum pass) takes everything', async () => {
    const { box, api } = await mount({ downloadAll: true });
    expect(box.canSelectAll()).toBe(true);
    box.selectAll();
    expect(box.selected().size).toBe(14);
    box.downloadAll();
    expect(api.eventPhotosDownloadLink).toHaveBeenCalledWith('camp-1', 'host', []);
    expect(box.offerOpen()).toBe(false);
  });

  it('an older server without the album flag goes by the account (canDownloadAll)', async () => {
    const { box } = await mount({ account: { canDownloadAll: true } });
    expect(box.canSelectAll()).toBe(true);
  });
});

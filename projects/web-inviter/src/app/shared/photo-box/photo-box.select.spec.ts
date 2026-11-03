import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiSelectable } from '@zouriel/ui/media';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';
import { SHARE_MAX_FILES } from './photo-share';

const photo = (id: string, canDelete: boolean, contentType = 'image/jpeg'): EventPhoto => ({
  id,
  url: `/assets/buckets/${id}.jpg`,
  thumbUrl: `/assets/buckets/${id}_t.jpg`,
  originalUrl: contentType.startsWith('video/') ? `/assets/buckets/${id}.mp4` : `/assets/buckets/${id}_o.jpg`,
  contentType,
  width: 100,
  height: 100,
  uploaderName: canDelete ? 'Me' : 'Mariyam',
  canDelete,
  createdAt: '2026-11-01T10:00:00Z',
  uploaderUserId: canDelete ? 'me-1' : 'u-2',
  sizeBytes: 1000,
});

type Box = {
  selecting: () => boolean;
  selected: () => ReadonlySet<string>;
  selectionActions: () => { id: string; enabled?: boolean }[];
  onSelectionAction(id: string): void;
  onViewerAction(e: { id: string }): void;
  view(p: EventPhoto): void;
  readyToShare: () => boolean;
  shareReady(): void;
  removeSelected(): Promise<void>;
  confirmingBulkRemoval: () => boolean;
  bulkRemoveMessage: () => string;
  selectAll(): void;
  share(photos: EventPhoto[]): Promise<void>;
};

describe('photo box: long-press select, Share, Download, Remove', () => {
  let fixture: ComponentFixture<PhotoBoxComponent>;
  let box: Box;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let shared: File[][];
  let active: boolean;
  const album = [photo('a1', true), photo('b2', false), photo('c3', false, 'video/mp4'), photo('d4', true)];

  /** Stubs the browser's share sheet and the network, then mounts the album as its host. */
  async function mount(opts: { share?: boolean; photos?: EventPhoto[]; as?: 'host' | 'guest' } = {}) {
    shared = [];
    active = true;
    const nav = navigator as unknown as Record<string, unknown>;
    if (opts.share !== false) {
      nav['canShare'] = (data: { files?: File[] }) => Array.isArray(data?.files);
      nav['share'] = vi.fn(async (data: { files: File[] }) => {
        shared.push(data.files);
      });
      Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive: active }) });
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(new Blob([`bytes of ${url}`]), { headers: { 'content-type': 'application/octet-stream' } })),
    );
    const photos = opts.photos ?? album;
    api = {
      campaignPhotos: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: photos.length, canUpload: false, photos })),
      invitationPhotos: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: photos.length, canUpload: false, photos })),
      removeCampaignPhoto: vi.fn(() => of(null)),
      eventPhotosDownloadLink: vi.fn(() => of({ url: '/api/photos/archives/x', name: 'x.zip', count: 2, bytes: 2000 })),
    };
    toast = { success: vi.fn(), danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: UiToastService, useValue: toast },
        { provide: SessionStore, useValue: { isSignedIn: signal(true), account: signal({ id: 'me-1' }) } },
      ],
    });
    fixture = TestBed.createComponent(PhotoBoxComponent);
    fixture.componentRef.setInput('campaignId', 'camp-1');
    fixture.componentRef.setInput('as', opts.as ?? 'host');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    box = fixture.componentInstance as unknown as Box;
  }

  const tiles = () => fixture.debugElement.queryAll(By.directive(UiSelectable));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    // The grid measures itself; jsdom has no layout.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const nav = navigator as unknown as Record<string, unknown>;
    delete nav['share'];
    delete nav['canShare'];
    delete (navigator as unknown as Record<string, unknown>)['userActivation'];
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
  });

  it('has no delete control on any tile: removing is only in the selection bar and the viewer', async () => {
    await mount();
    expect(tiles().length).toBe(4);
    const grid = fixture.nativeElement.querySelector('ui-masonry-grid') as HTMLElement;
    expect(grid.querySelectorAll('button, [role="button"]:not(ui-selectable)').length).toBe(0);
    expect(grid.textContent).not.toMatch(/remove/i);
    expect(grid.querySelector('[aria-label*="Remove" i], [title*="Remove" i]')).toBeNull();
  });

  it('a long press starts choosing with that photo; taps then toggle more', async () => {
    await mount();
    tiles()[1].triggerEventHandler('longPress');
    await settle();
    expect(box.selecting()).toBe(true);
    expect([...box.selected()]).toEqual(['b2']);
    expect(fixture.nativeElement.querySelector('ui-selection-bar')).not.toBeNull();

    tiles()[2].triggerEventHandler('tap');
    tiles()[1].triggerEventHandler('tap');
    await settle();
    expect([...box.selected()]).toEqual(['c3']);
  });

  it('a tap without choosing opens the viewer', async () => {
    await mount();
    tiles()[0].triggerEventHandler('tap');
    await settle();
    expect(box.selecting()).toBe(false);
    expect((fixture.componentInstance as unknown as { viewing: () => boolean }).viewing()).toBe(true);
  });

  it('the bar offers Share and Download, and Remove only once something removable is chosen', async () => {
    await mount();
    tiles()[1].triggerEventHandler('longPress');
    await settle();
    expect(box.selectionActions().map((a) => a.id)).toEqual(['share', 'download']);
    tiles()[0].triggerEventHandler('tap');
    await settle();
    expect(box.selectionActions().map((a) => a.id)).toEqual(['share', 'download', 'remove']);
  });

  it('where the browser cannot share files, Share is not offered at all', async () => {
    await mount({ share: false });
    tiles()[0].triggerEventHandler('longPress');
    await settle();
    expect(box.selectionActions().map((a) => a.id)).toEqual(['download', 'remove']);
    expect((fixture.componentInstance as unknown as { viewerActions: { id: string; when?: () => boolean }[] }).viewerActions.find((a) => a.id === 'share')!.when!()).toBe(false);
  });

  it('Share fetches the originals and hands them to the share sheet with names and types', async () => {
    await mount();
    tiles()[1].triggerEventHandler('longPress');
    tiles()[2].triggerEventHandler('tap');
    await settle();
    box.onSelectionAction('share');
    await vi.waitFor(() => expect(shared.length).toBe(1));
    const files = shared[0];
    expect(files.map((f) => f.name)).toEqual(['invitesblog-1-b2.jpg', 'invitesblog-2-c3.mp4']);
    expect(files.map((f) => f.type)).toEqual(['image/jpeg', 'video/mp4']);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
      '/assets/buckets/b2_o.jpg',
      '/assets/buckets/c3.mp4',
    ]);
    await settle();
    expect(box.selecting()).toBe(false);
  });

  it('when fetching outlasted the tap, it asks for one more tap and shares from inside it', async () => {
    await mount();
    active = false;
    await box.share([album[0]]);
    await settle();
    expect(shared.length).toBe(0);
    expect(box.readyToShare()).toBe(true);
    active = true;
    box.shareReady();
    await vi.waitFor(() => expect(shared.length).toBe(1));
    expect(shared[0].map((f) => f.name)).toEqual(['invitesblog-a1.jpg']);
  });

  it('refuses more than the share sheet can carry, in plain words', async () => {
    const many = Array.from({ length: SHARE_MAX_FILES + 1 }, (_, i) => photo(`p${i}`, false));
    await mount({ photos: many });
    await box.share(many);
    expect(toast.danger).toHaveBeenCalledWith(expect.stringContaining('You can share up to 100 at a time, and 101 are selected'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Download of the selection asks for one zip link with the chosen ids', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await mount();
    tiles()[0].triggerEventHandler('longPress');
    tiles()[3].triggerEventHandler('tap');
    await settle();
    box.onSelectionAction('download');
    expect(api['eventPhotosDownloadLink']).toHaveBeenCalledWith('camp-1', 'host', ['a1', 'd4']);
  });

  it('Remove in the bar removes only what is this person’s, after confirming, and says the rest stay', async () => {
    await mount();
    tiles()[0].triggerEventHandler('longPress');
    tiles()[1].triggerEventHandler('tap');
    tiles()[3].triggerEventHandler('tap');
    await settle();
    box.onSelectionAction('remove');
    expect(box.confirmingBulkRemoval()).toBe(true);
    expect(box.bulkRemoveMessage()).toContain("The other 1 selected aren't yours to remove and stay.");
    expect(api['removeCampaignPhoto']).not.toHaveBeenCalled();
    await box.removeSelected();
    await settle();
    expect(api['removeCampaignPhoto'].mock.calls.map((c) => c[1])).toEqual(['a1', 'd4']);
    expect(tiles().length).toBe(2);
    expect(toast.success).toHaveBeenCalledWith('2 items removed.');
  });

  it('the viewer still removes the open photo (after confirming), and saves a download without a new tab', async () => {
    const links: { href: string; download: string; target: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      links.push({ href: this.href, download: this.download, target: this.target });
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    await mount();
    box.view(album[0]);
    await settle();
    box.onViewerAction({ id: 'download' });
    await vi.waitFor(() => expect(links.length).toBe(1));
    expect(links[0]).toEqual({ href: 'blob:x', download: 'invitesblog-a1.jpg', target: '' });

    box.view(album[0]);
    await settle();
    box.onViewerAction({ id: 'remove' });
    await settle();
    expect((fixture.componentInstance as unknown as { confirmingRemoval: () => boolean }).confirmingRemoval()).toBe(true);
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiMediaAction } from '@zouriel/ui/file-viewer';
import { ApiService } from '../api/api.service';
import { ModerationStore } from '../moderation/moderation.store';
import { SessionStore } from '../services/session.store';
import { EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

const photo = (id: string, over: Partial<EventPhoto> = {}): EventPhoto => ({
  id, url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}-t.jpg`, originalUrl: `https://x/${id}-o.jpg`, contentType: 'image/jpeg',
  width: 100, height: 100, uploaderName: 'Mariyam', canDelete: false, createdAt: '2026-11-01T10:00:00Z', uploaderUserId: 'u-2', ...over,
});

type Box = {
  photos: () => EventPhoto[];
  viewerActions: UiMediaAction[];
  viewing: { set: (v: boolean) => void };
  viewingAt: { set: (v: number) => void };
  onViewerAction: (e: { id: string }) => void;
};

async function mount(photos: EventPhoto[], signedIn = true) {
  const api = {
    invitationPhotos: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: photos.length, canUpload: false, photos })),
    reportContent: vi.fn(() => of({ hidden: true, message: 'Hidden.' })),
    blockPerson: vi.fn(() => of(null)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(signedIn), account: signal(signedIn ? { id: 'me-1' } : null) } },
    ],
  });
  const store = TestBed.inject(ModerationStore);
  const fixture = TestBed.createComponent(PhotoBoxComponent);
  fixture.componentRef.setInput('campaignId', 'camp-1');
  fixture.componentRef.setInput('as', 'guest');
  fixture.detectChanges();
  const box = fixture.componentInstance as unknown as Box;
  /** Which actions the viewer would draw over item `at`. */
  const actionsAt = (at: number) =>
    box.viewerActions.filter((a) => !a.when || a.when({ src: '' } as never, at)).map((a) => a.id);
  return { fixture, api, store, box, actionsAt };
}

describe('PhotoBoxComponent: report and block', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("offers Report on someone else's photo, not on your own", async () => {
    const { actionsAt } = await mount([photo('p-1'), photo('p-2', { uploaderUserId: 'me-1', canDelete: true })]);
    expect(actionsAt(0)).toEqual(['download', 'report']);
    expect(actionsAt(1)).toEqual(['download', 'remove']);
  });

  it('without an account, Report links to the contact page instead', async () => {
    const { actionsAt, box } = await mount([photo('p-1')], false);
    expect(actionsAt(0)).toEqual(['download', 'report-contact']);
    expect(box.viewerActions.find((a) => a.id === 'report-contact')!.href!({} as never, 0)).toBe('/contact');
  });

  it('closes the viewer and asks to report the open item, naming its uploader', async () => {
    const { box, store } = await mount([photo('p-1', { contentType: 'video/mp4' })]);
    box.viewingAt.set(0);
    box.viewing.set(true);
    box.onViewerAction({ id: 'report' });
    expect(store.reporting()).toEqual({ kind: 'photo', id: 'p-1', noun: 'video', owner: { userId: 'u-2', name: 'Mariyam' } });
  });

  it('takes a reported photo, and everything a blocked person added, out of the grid', async () => {
    const { box, store } = await mount([photo('p-1'), photo('p-2'), photo('p-3', { uploaderUserId: 'u-3', uploaderName: 'Aisha' })]);
    expect(box.photos().map((p) => p.id)).toEqual(['p-1', 'p-2', 'p-3']);
    await store.report({ kind: 'photo', id: 'p-3', noun: 'photo' }, 'sexual', '');
    expect(box.photos().map((p) => p.id)).toEqual(['p-1', 'p-2']);
    await store.block({ userId: 'u-2', name: 'Mariyam' });
    expect(box.photos()).toEqual([]);
  });
});

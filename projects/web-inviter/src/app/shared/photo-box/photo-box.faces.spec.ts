import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { EventPhoto, EventPhotoBox, FaceGroups } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

const photo = (id: string, people: string[] | null): EventPhoto => ({
  id, url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}-t.jpg`, originalUrl: `https://x/${id}-o.jpg`,
  contentType: 'image/jpeg', width: 100, height: 100, uploaderName: 'Aisha', canDelete: false,
  createdAt: '2026-11-01T10:00:00Z', people,
});
const person = (id: string, name: string | null, n: number) => ({
  id, name, photoCount: n, coverUrl: `https://x/${id}.jpg`, coverX: 0.2, coverY: 0.2, coverW: 0.3, coverH: 0.3,
});
const faces = (over: Partial<FaceGroups> = {}): FaceGroups => ({
  on: true, canName: false, waiting: 0, people: [person('p1', 'Mia', 2), person('p2', null, 1)], ...over,
});
const photos = [photo('a', ['p1']), photo('b', ['p1', 'p2']), photo('c', [])];

type Box = {
  shown: () => EventPhoto[];
  peopleOpen: () => boolean;
};

function mount(as: 'bucket' | 'host' | 'guest', f: FaceGroups | null) {
  const box = (faceBox: FaceGroups | null): EventPhotoBox => ({ campaignId: 'c1', eventTitle: 'Gala', count: 3, canUpload: false, photos, faces: faceBox });
  const api = {
    mediaBucketMedia: vi.fn(() => of(box(f))),
    campaignPhotos: vi.fn(() => of(box(f))),
    invitationPhotos: vi.fn(() => of(box(f))),
    ignoreFacePerson: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(true), account: signal({ id: 'me-1' }) } },
    ],
  });
  const fixture = TestBed.createComponent(PhotoBoxComponent);
  fixture.componentRef.setInput('campaignId', 'id-1');
  fixture.componentRef.setInput('as', as);
  fixture.detectChanges();
  return { fixture, api, el: fixture.nativeElement as HTMLElement, box: fixture.componentInstance as unknown as Box };
}

describe('photo box: faces', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows no notice or tabs when grouping is off', () => {
    const { el } = mount('bucket', null);
    expect(el.textContent).not.toContain('grouped by face');
    expect(el.querySelector('.strip')).toBeNull();
  });

  it('shows nothing either when the box says grouping is not on', () => {
    expect(mount('bucket', { ...faces(), on: false }).el.querySelector('.strip')).toBeNull();
  });

  it('shows the notice with Opt out, and the quiet waiting line', () => {
    const { el, fixture, box } = mount('guest', faces({ waiting: 3 }));
    expect(el.querySelector('.faces')!.textContent).toContain('Photos here are grouped by face.');
    expect(el.querySelector('.faces')!.textContent).toContain('Grouping 3 photos…');
    const optOut = [...el.querySelectorAll('.faces button')].find((b) => b.textContent!.trim() === 'Opt out') as HTMLButtonElement;
    optOut.click();
    fixture.detectChanges();
    expect(box.peopleOpen()).toBe(true);
  });

  it('offers the host "Name people" where a guest sees "Opt out"', () => {
    const { el, fixture, box } = mount('bucket', faces({ canName: true }));
    const buttons = [...el.querySelectorAll('.faces button')].map((b) => b.textContent!.trim());
    expect(buttons).toContain('Name people');
    expect(buttons).not.toContain('Opt out');
    ([...el.querySelectorAll('.faces button')].find((b) => b.textContent!.trim() === 'Name people') as HTMLButtonElement).click();
    fixture.detectChanges();
    // The host's way in is the People tab, not the guests' opt-out sheet.
    expect(box.peopleOpen()).toBe(false);
    expect(el.querySelector('app-face-people-tab')).not.toBeNull();
  });

  it('has no face strip above the grid', () => {
    expect(mount('guest', faces()).el.querySelector('.strip')).toBeNull();
  });

  it('shows Photos and People tabs to the host only, and only while grouping is on', () => {
    const labels = (el: HTMLElement) => [...el.querySelectorAll('ui-tabs ui-tab, ui-tabs [role="tab"]')].map((t) => t.textContent!.trim()).filter(Boolean);
    expect(mount('bucket', faces({ canName: true })).el.querySelector('ui-tabs')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(mount('guest', faces({ canName: false })).el.querySelector('ui-tabs')).toBeNull();
    TestBed.resetTestingModule();
    expect(mount('bucket', { ...faces({ canName: true }), on: false }).el.querySelector('ui-tabs')).toBeNull();
    TestBed.resetTestingModule();
    expect(mount('bucket', null).el.querySelector('ui-tabs')).toBeNull();
    expect(labels(document.createElement('div'))).toEqual([]);
  });

  it('puts "Name people" in the notice for the host and switches to the People tab', () => {
    const { fixture, el } = mount('bucket', faces({ canName: true }));
    const btn = [...el.querySelectorAll('.faces button')].find((b) => b.textContent!.trim() === 'Name people') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    fixture.detectChanges();
    expect(el.querySelector('app-face-people-tab')).not.toBeNull();
    expect(el.querySelector('ui-masonry-grid')).toBeNull();
  });

  it('narrows the album to one person from "See photos", then shows all again', () => {
    const { fixture, el, box } = mount('bucket', faces({ canName: true }));
    (box as unknown as { seePerson: (p: unknown) => void }).seePerson(person('p2', null, 1));
    fixture.detectChanges();
    expect(box.shown().map((p) => p.id)).toEqual(['b']);
    expect(el.querySelector('.only')!.textContent).toContain('Showing photos of one person.');
    (el.querySelector('.only button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(box.shown()).toHaveLength(3);
  });

  it('sends "That\'s me" through the guest door and reloads the box', () => {
    const { fixture, api, el } = mount('guest', faces());
    (el.querySelector('.faces button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = fixture.debugElement.query((d) => d.name === 'app-face-people-dialog').componentInstance as {
      asking: { set: (v: unknown) => void };
      confirmAsk: () => void;
    };
    dialog.asking.set(person('p1', 'Mia', 2));
    dialog.confirmAsk();
    expect(api.ignoreFacePerson).toHaveBeenCalledWith({ as: 'guest', id: 'id-1' }, 'p1');
    expect(api.invitationPhotos).toHaveBeenCalledTimes(2);
  });
});

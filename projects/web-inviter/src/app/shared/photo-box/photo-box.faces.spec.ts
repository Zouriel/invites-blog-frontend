import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  toggleFace: (id: string) => void;
  shown: () => EventPhoto[];
  faceChosen: (id: string) => boolean;
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

  it('shows no notice, strip or People filter when grouping is off', () => {
    const { el } = mount('bucket', null);
    expect(el.textContent).not.toContain('grouped by face');
    expect(el.querySelector('.strip')).toBeNull();
  });

  it('shows nothing either when the box says grouping is not on', () => {
    expect(mount('bucket', { ...faces(), on: false }).el.querySelector('.strip')).toBeNull();
  });

  it('shows the notice with Opt out, and the quiet waiting line', () => {
    const { el, fixture, box } = mount('guest', faces({ waiting: 3 }));
    expect(el.querySelector('.faces')!.textContent).toContain('Photos in this album are grouped by face.');
    expect(el.querySelector('.faces')!.textContent).toContain('Grouping 3 photos…');
    const optOut = [...el.querySelectorAll('.faces button')].find((b) => b.textContent!.trim() === 'Opt out') as HTMLButtonElement;
    optOut.click();
    fixture.detectChanges();
    expect(box.peopleOpen()).toBe(true);
  });

  it('filters by a face tapped in the strip, and taps again to clear', () => {
    const { fixture, el, box } = mount('bucket', faces());
    expect(el.querySelectorAll('.strip__face')).toHaveLength(2);
    expect(el.querySelector('.strip')!.textContent).toContain('Mia');
    expect(el.querySelector('.strip')!.textContent).toContain('Person 2');
    box.toggleFace('p1');
    fixture.detectChanges();
    expect(box.shown().map((p) => p.id)).toEqual(['a', 'b']);
    expect(box.faceChosen('p1')).toBe(true);
    expect([...el.querySelectorAll('ui-filter-chips ui-chip')].map((c) => c.textContent!.trim())).toEqual(['Mia']);
    box.toggleFace('p1');
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
    dialog.asking.set({ kind: 'me', person: person('p1', 'Mia', 2) });
    dialog.confirmAsk();
    expect(api.ignoreFacePerson).toHaveBeenCalledWith({ as: 'guest', id: 'id-1' }, 'p1');
    expect(api.invitationPhotos).toHaveBeenCalledTimes(2);
  });
});

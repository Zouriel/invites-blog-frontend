import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { FaceGroups, FaceScope } from '../utils/types/api.types';
import { FacePeopleTabComponent } from './face-people-tab.component';

const person = (id: string, name: string | null, n = 1) => ({
  id, name, photoCount: n, coverUrl: `https://x/${id}.jpg`, coverX: 0.2, coverY: 0.2, coverW: 0.3, coverH: 0.3,
});
const faces: FaceGroups = { on: true, canName: true, waiting: 2, people: [person('p1', 'Mia', 3), person('p2', null), person('p3', 'Ali')] };

type Tab = {
  pick: (p: unknown) => void;
  draft: string;
  saveName: (p: unknown) => void;
  merging: { set: (v: unknown) => void };
  confirmMerge: () => void;
  removing: { set: (v: unknown) => void };
  confirmRemove: () => void;
  others: () => { id: string }[];
};

function mount(scope: FaceScope) {
  const api = {
    nameFacePerson: vi.fn(() => of(person('p2', 'Zed'))),
    mergeFacePerson: vi.fn(() => of(person('p1', 'Mia'))),
    ignoreFacePerson: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: ApiService, useValue: api }, { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn() } }],
  });
  const fixture = TestBed.createComponent(FacePeopleTabComponent);
  fixture.componentRef.setInput('faces', faces);
  fixture.componentRef.setInput('scope', scope);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  fixture.detectChanges();
  return { fixture, api, changed, el: fixture.nativeElement as HTMLElement, tab: fixture.componentInstance as unknown as Tab };
}

describe('People tab', () => {
  it('lists every face, named or not, and says photos are being grouped', () => {
    const { el } = mount({ as: 'bucket', id: 'b1' });
    expect(el.querySelectorAll('.face')).toHaveLength(3);
    expect(el.textContent).toContain('Unnamed');
    expect(el.textContent).toContain('Grouping 2 photos…');
  });

  it('names a face, then reloads', () => {
    const { api, changed, tab } = mount({ as: 'bucket', id: 'b1' });
    tab.pick(faces.people[1]);
    tab.draft = '  Zed ';
    tab.saveName(faces.people[1]);
    expect(api.nameFacePerson).toHaveBeenCalledWith({ as: 'bucket', id: 'b1' }, 'p2', 'Zed');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('offers only already-named other people for "Same person as"', () => {
    const { fixture, tab } = mount({ as: 'bucket', id: 'b1' });
    tab.pick(faces.people[1]);
    fixture.detectChanges();
    expect(tab.others().map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(document.body.textContent).toContain('Same person as…');
  });

  it('merges into the chosen person with the right ids, on the bucket route and the host route', () => {
    for (const scope of [{ as: 'bucket', id: 'b1' }, { as: 'host', id: 'c1' }] as FaceScope[]) {
      const { api, changed, tab } = mount(scope);
      tab.merging.set({ from: faces.people[1], into: faces.people[2] });
      tab.confirmMerge();
      expect(api.mergeFacePerson).toHaveBeenCalledWith(scope, 'p2', 'p3');
      expect(changed).toHaveBeenCalledTimes(1);
      TestBed.resetTestingModule();
    }
  });

  it('removes a group with the ignore call', () => {
    const { api, tab } = mount({ as: 'host', id: 'c1' });
    tab.removing.set(faces.people[1]);
    tab.confirmRemove();
    expect(api.ignoreFacePerson).toHaveBeenCalledWith({ as: 'host', id: 'c1' }, 'p2');
  });
});

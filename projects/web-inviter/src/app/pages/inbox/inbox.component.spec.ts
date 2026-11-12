import { provideGuidanceStub } from '../../shared/guidance/guidance.testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { MyInvite } from '../../shared/utils/types/api.types';
import { InboxComponent } from './inbox.component';

const invite = (over: Partial<MyInvite>): MyInvite => ({
  inviteId: 'i1', campaignId: 'c1', eventTitle: 'Aisha and Ali', eventDate: '2026-12-12T14:00:00Z', venueType: 'Wedding',
  rsvpStatus: 'Going', isNew: false, isPast: false, cancelled: false, inviterName: 'Mariyam', previewImageUrl: '/assets/a.jpg',
  photoCount: 3, kind: 'invitation', calendar: null, colours: null, ...over,
});

async function mount(list: MyInvite[], mine: unknown = of([])) {
  TestBed.configureTestingModule({
    imports: [InboxComponent],
    providers: [
      provideRouter([]),
      provideGuidanceStub(),
      { provide: ApiService, useValue: { myInvites: vi.fn(() => of(list)), myCampaigns: vi.fn(() => mine) } },
    ],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(InboxComponent);
  const el = fixture.nativeElement as HTMLElement;
  document.body.appendChild(el);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
  };
  await settle();
  return { fixture, el, settle, router };
}

describe('InboxComponent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it("puts the organiser on Studio on the invitation's tile, their first letter without a picture; nothing otherwise", async () => {
    const { el } = await mount([
      invite({ venueName: 'Bandos Hall', venueLogoUrl: null }),
      invite({ inviteId: 'i2', campaignId: 'c2', eventTitle: 'Eid party' }),
    ]);
    const tiles = el.querySelectorAll<HTMLElement>('ui-poster-grid .tile');
    const tag = tiles[0].querySelector('ui-avatar-tag')!;
    expect(tag.getAttribute('aria-label')).toBe('Bandos Hall');
    // On the picture's top-left corner (the grid's corner slot), not in the details under the title.
    expect(tag.closest('.corner')).not.toBeNull();
    expect(tag.closest('ui-scrim')).toBeNull();
    expect(tiles[0].querySelectorAll('ui-avatar-tag').length).toBe(1);
    expect(tag.querySelector('img')).toBeNull();
    expect(tag.textContent).toContain('B');
    expect(tiles[1].querySelector('ui-avatar-tag')).toBeNull();
  });

  it('shows each invitation as a picture tile with its details on it, a dot on a new one', async () => {
    const { el } = await mount([
      invite({ isNew: true, rsvpStatus: 'NotGoing' }),
      invite({ inviteId: 'i2', campaignId: 'c2', eventTitle: 'Eid party', previewImageUrl: '/templates/x/index.html', colours: ['#fdf1f4', '#c9a227'], isPast: true, kind: 'saveTheDate', photoCount: 0 }),
      invite({ inviteId: 'i3', campaignId: 'c3', eventTitle: 'Gone', cancelled: true }),
    ]);
    const tiles = el.querySelectorAll<HTMLElement>('ui-poster-grid .tile');
    expect(tiles.length).toBe(2);
    const first = tiles[0].querySelector('ui-scrim')!.textContent!.replace(/\s+/g, ' ');
    expect(first).toContain('Aisha and Ali');
    expect(first).toContain('Mariyam · 12 Dec 2026');
    expect(first).toContain('Not going');
    expect(first).toContain('3 photos');
    expect(tiles[0].querySelector('.dot--primary')).not.toBeNull();
    const second = tiles[1].querySelector('ui-scrim')!.textContent!;
    expect(second).toContain('Save the date');
    expect(second).toContain('Past');
    expect(second).not.toContain('No reply yet');
    // A template's page is not a picture: the design's colours instead.
    expect(tiles[1].querySelector('img')).toBeNull();
    expect((tiles[1].querySelector('.fallback') as HTMLElement).style.background).toContain('linear-gradient');
  });

  it('a tile is a link to the invitation, and tapping it goes there with nothing opened in between', async () => {
    const { el, settle, router } = await mount([invite({}), invite({ inviteId: 'i2', campaignId: 'c2', eventTitle: 'Eid party' })]);
    const link = el.querySelectorAll<HTMLAnchorElement>('a.tile')[1];
    expect(link.getAttribute('href')).toBe('/invitation/c2');
    link.click();
    await settle();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/invitation/c2');
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });
});

describe('InboxComponent empty and celebrant events (docs/GUIDANCE.md)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('nothing yet: the inbox picture, what fills it and two ways on', async () => {
    const { el } = await mount([]);
    const empty = el.querySelector('ui-empty-state')!;
    expect(empty.textContent).toContain('No invitations yet');
    expect(empty.textContent).toContain('Invitations sent to your email or phone appear here.');
    expect(empty.querySelector('app-empty-art img')?.getAttribute('src')).toContain('empty-inbox-');
    expect(empty.querySelectorAll('ui-starter-card').length).toBe(2);
  });

  it('never says empty while the second list is still on its way', async () => {
    const pending = new Subject<unknown[]>();
    const { el, settle } = await mount([], pending);
    expect(el.querySelector('ui-empty-state')).toBeNull();
    pending.next([]);
    pending.complete();
    await settle();
    expect(el.querySelector('ui-empty-state')).not.toBeNull();
  });

  it("an event made for this person is under Your events, and the page isn't empty", async () => {
    const mine = [{ id: 'e1', title: 'Our wedding', status: 'Dispatched', relation: 'celebrant', eventStartAt: '2026-12-12T14:00:00Z', previewImageUrl: null, colours: null }];
    const { el } = await mount([], of(mine));
    expect(el.querySelector('ui-empty-state')).toBeNull();
    expect(el.textContent).toContain('Your events');
    expect(el.textContent).toContain('Our wedding');
  });
});

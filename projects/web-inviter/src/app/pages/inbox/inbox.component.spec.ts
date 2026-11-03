import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { MyInvite } from '../../shared/utils/types/api.types';
import { InboxComponent } from './inbox.component';

const invite = (over: Partial<MyInvite>): MyInvite => ({
  inviteId: 'i1', campaignId: 'c1', eventTitle: 'Aisha and Ali', eventDate: '2026-12-12T14:00:00Z', venueType: 'Wedding',
  rsvpStatus: 'Going', isNew: false, isPast: false, cancelled: false, inviterName: 'Mariyam', previewImageUrl: '/assets/a.jpg',
  photoCount: 3, kind: 'invitation', calendar: null, colours: null, ...over,
});

async function mount(list: MyInvite[]) {
  TestBed.configureTestingModule({
    imports: [InboxComponent],
    providers: [provideRouter([]), { provide: ApiService, useValue: { myInvites: vi.fn(() => of(list)) } }],
  });
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
  return { fixture, el, settle };
}

describe('InboxComponent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('shows invitations as pictures only: no title, date or badge on the grid, a dot for a new one', async () => {
    const { el } = await mount([
      invite({ isNew: true }),
      invite({ inviteId: 'i2', campaignId: 'c2', eventTitle: 'Eid party', previewImageUrl: '/templates/x/index.html', colours: ['#fdf1f4', '#c9a227'] }),
      invite({ inviteId: 'i3', campaignId: 'c3', eventTitle: 'Gone', cancelled: true }),
    ]);
    const grid = el.querySelector('ui-poster-grid')!;
    const tiles = grid.querySelectorAll('button.tile');
    expect(tiles.length).toBe(2);
    expect(grid.textContent!.trim()).toBe('');
    expect(grid.querySelector('ui-badge')).toBeNull();
    expect(tiles[0].getAttribute('aria-label')).toBe('Aisha and Ali, New');
    expect(tiles[0].querySelector('.dot--primary')).not.toBeNull();
    // A template's page is not a picture: the design's colours instead.
    expect(tiles[1].querySelector('img')).toBeNull();
    expect((tiles[1].querySelector('.fallback') as HTMLElement).style.background).toContain('linear-gradient');
  });

  it('opens a tile full-size with the details and the way into the invitation', async () => {
    const { el, settle } = await mount([invite({}), invite({ inviteId: 'i2', campaignId: 'c2', eventTitle: 'Eid party', rsvpStatus: 'NoResponse', isPast: true, photoCount: 1 })]);
    (el.querySelectorAll('button.tile')[1] as HTMLButtonElement).click();
    await settle();
    const dlg = el.querySelector('[role=dialog]')!;
    expect(dlg.getAttribute('aria-label')).toBe('Eid party');
    const scrim = dlg.querySelector('ui-scrim')!;
    const text = scrim.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Eid party');
    expect(text).toContain('December 2026');
    expect(text).toContain('From Mariyam');
    expect(text).toContain('No reply yet');
    expect(text).toContain('Past');
    expect(text).toContain('1 photo');
    const open = scrim.querySelector('a[href="/invitation/c2"]');
    expect(open?.textContent).toContain('Open invitation');
  });

  it('shows a save the date as such, not a reply', async () => {
    const { el, settle } = await mount([invite({ kind: 'saveTheDate' })]);
    (el.querySelector('button.tile') as HTMLButtonElement).click();
    await settle();
    const text = el.querySelector('ui-scrim')!.textContent!;
    expect(text).toContain('Save the date');
    expect(text).not.toContain('Going');
  });
});

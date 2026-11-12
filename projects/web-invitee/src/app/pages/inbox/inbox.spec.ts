import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { InboxCard } from '../../shared/utils/types/api.types';
import { InboxComponent } from './inbox';

const card = (over: Partial<InboxCard>): InboxCard => ({
  inviteId: 'i1', eventTitle: 'Aisha and Ali', eventDate: '2026-12-12T14:00:00Z', venueType: 'Wedding',
  rsvpStatus: 'Going', isNew: false, isPast: false, cancelled: false, kind: 'invitation', ...over,
});

async function mount(list: InboxCard[]) {
  TestBed.configureTestingModule({
    imports: [InboxComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { getMyInvites: vi.fn(() => of(list)), getLinkableContacts: vi.fn(() => of([])) } },
    ],
  });
  const fixture = TestBed.createComponent(InboxComponent);
  const el = fixture.nativeElement as HTMLElement;
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
  }
  return el;
}

describe('Inbox on me.invites.blog: the Studio badge', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("puts the organiser's picture and name in the corner of its card, read as just the name", async () => {
    const el = await mount([
      card({ venueName: 'Coco Palm', venueLogoUrl: 'https://cdn.example/coco.png' }),
      card({ inviteId: 'i2', eventTitle: 'Eid party' }),
    ]);
    const cards = el.querySelectorAll<HTMLElement>('.invite');
    expect(cards).toHaveLength(2);
    const tag = cards[0].querySelector('ui-avatar-tag')!;
    expect(tag.getAttribute('aria-label')).toBe('Coco Palm');
    expect(tag.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/coco.png');
    expect(cards[1].querySelector('ui-avatar-tag')).toBeNull();
  });
});

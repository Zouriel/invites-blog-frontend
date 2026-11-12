import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { MyCampaign } from '../../shared/utils/types/api.types';
import { MeComponent } from './me.component';

const event = (over: Partial<MyCampaign>): MyCampaign => ({
  id: 'c1', title: 'Aisha and Ali', slug: 'a', status: 'Dispatched', eventType: 'Wedding', eventStartAt: '2026-12-12T14:00:00Z',
  guestCount: 12, templateName: null, createdAt: '2026-10-01T00:00:00Z', previewImageUrl: '/assets/a.jpg', photoCount: 4,
  mediaOnly: false, resumeStep: null, relation: 'host', canManage: true, plan: 'Free', kind: 'invitation', colours: null, ...over,
});

async function mount(list: MyCampaign[]) {
  TestBed.configureTestingModule({
    imports: [MeComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { myCampaigns: vi.fn(() => of(list)) } },
      { provide: SessionStore, useValue: { account: signal({ id: 'me', displayName: 'Zouriel', email: 'z@example.com' }) } },
    ],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(MeComponent);
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

describe('MeComponent hosting grid', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('shows hosted events as picture tiles with their details on them, and a dot on an unfinished one', async () => {
    const { el } = await mount([
      event({ plan: 'GoldPass', kind: 'saveTheDate' }),
      event({ id: 'c2', title: 'Draft party', resumeStep: 'guests', guestCount: 1, photoCount: 0 }),
      event({ id: 'c3', title: 'Called off', status: 'Cancelled' }),
    ]);
    const tiles = el.querySelectorAll<HTMLElement>('ui-poster-grid .tile');
    expect(tiles.length).toBe(2);
    expect(el.textContent).toContain('Hosting (2)');
    const first = tiles[0].querySelector('ui-scrim')!.textContent!.replace(/\s+/g, ' ');
    expect(first).toContain('Aisha and Ali');
    expect(first).toContain('12 Dec 2026 · 12 guests');
    expect(first).toContain('Save the date');
    expect(first).toContain('Gold');
    expect(first).toContain('4 photos');
    const second = tiles[1].querySelector('ui-scrim')!.textContent!.replace(/\s+/g, ' ');
    expect(second).toContain('1 guest');
    expect(second).toContain('Not finished · Continue');
    expect(tiles[1].querySelector('.dot--warning')).not.toBeNull();
    expect(tiles[0].querySelector('.dot')).toBeNull();
  });

  it('a finished event links to its dashboard, an unfinished one to the step it was left at', async () => {
    const { el, settle, router } = await mount([event({}), event({ id: 'c2', title: 'Draft', resumeStep: 'guests' })]);
    const links = el.querySelectorAll<HTMLAnchorElement>('a.tile');
    expect(links[0].getAttribute('href')).toBe('/dashboard/c1');
    expect(links[1].getAttribute('href')).toBe('/create/c2/guests');
    links[1].click();
    await settle();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/create/c2/guests');
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });

  it("puts the organiser's picture and name on the tile of an event they run on Studio, small, read as just the name", async () => {
    const { el } = await mount([
      event({ venueName: 'Coco Palm Dhuni Kolhu', venueLogoUrl: 'https://cdn.example/coco.png' }),
      event({ id: 'c2', title: 'Home party', venueName: null, venueLogoUrl: null }),
    ]);
    const tiles = el.querySelectorAll<HTMLElement>('ui-poster-grid .tile');
    const tag = tiles[0].querySelector('ui-avatar-tag')!;
    expect(tag).not.toBeNull();
    expect(tag.getAttribute('aria-label')).toBe('Coco Palm Dhuni Kolhu');
    expect(tag.textContent).toContain('Coco Palm Dhuni Kolhu');
    expect(tag.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/coco.png');
    expect(tiles[1].querySelector('ui-avatar-tag')).toBeNull();
  });

  it('marks an event somebody organised for this person, and a photos-only one', async () => {
    const { el } = await mount([event({ relation: 'celebrant' }), event({ id: 'c2', title: 'Trip', mediaOnly: true })]);
    const tiles = el.querySelectorAll<HTMLElement>('ui-poster-grid .tile');
    expect(tiles[0].textContent).toContain('Your event');
    expect(tiles[1].textContent).toContain('Photos only');
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  return { fixture, el, settle };
}

describe('MeComponent hosting grid', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('shows hosted events as pictures only, with a dot on an unfinished one', async () => {
    const { el } = await mount([
      event({}),
      event({ id: 'c2', title: 'Draft party', resumeStep: 'guests' }),
      event({ id: 'c3', title: 'Called off', status: 'Cancelled' }),
    ]);
    const grid = el.querySelector('ui-poster-grid')!;
    const tiles = grid.querySelectorAll('button.tile');
    expect(tiles.length).toBe(2);
    expect(grid.textContent!.trim()).toBe('');
    expect(tiles[1].getAttribute('aria-label')).toBe('Draft party, Not finished');
    expect(tiles[1].querySelector('.dot--warning')).not.toBeNull();
    expect(tiles[0].querySelector('.dot')).toBeNull();
    expect(el.textContent).toContain('Hosting (2)');
  });

  it('opens a finished event with its counts, plan and the way to its dashboard', async () => {
    const { el, settle } = await mount([event({ plan: 'GoldPass', kind: 'saveTheDate' })]);
    (el.querySelector('button.tile') as HTMLButtonElement).click();
    await settle();
    const scrim = el.querySelector('[role=dialog] ui-scrim')!;
    const text = scrim.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Aisha and Ali');
    expect(text).toContain('12 guests');
    expect(text).toContain('4 photos');
    expect(text).toContain('Save the date');
    expect(text).toContain('Gold');
    const go = scrim.querySelector('a[href="/dashboard/c1"]');
    expect(go?.textContent).toContain('Open event');
  });

  it('opens an unfinished event on the step it was left at', async () => {
    const { el, settle } = await mount([event({ resumeStep: 'guests' })]);
    (el.querySelector('button.tile') as HTMLButtonElement).click();
    await settle();
    const scrim = el.querySelector('ui-scrim')!;
    expect(scrim.textContent).toContain('Not finished');
    const go = scrim.querySelector('a[href="/create/c1/guests"]');
    expect(go?.textContent).toContain('Continue');
  });

  it('marks an event somebody organised for this person, and a photos-only one', async () => {
    const { el, settle } = await mount([event({ relation: 'celebrant' }), event({ id: 'c2', title: 'Trip', mediaOnly: true })]);
    (el.querySelectorAll('button.tile')[0] as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector('ui-scrim')!.textContent).toContain('Your event');
    (el.querySelector('[role=dialog] .x') as HTMLButtonElement).click();
    await settle();
    (el.querySelectorAll('button.tile')[1] as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector('ui-scrim')!.textContent).toContain('Photos only');
  });
});

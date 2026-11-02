import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { BlockedPerson } from '../../shared/utils/types/api.types';
import { BlockedPeopleComponent } from './blocked-people.component';

const person = (userId: string, displayName: string): BlockedPerson => ({ userId, displayName, avatarUrl: null, blockedAt: '2026-11-01T10:00:00Z' });

async function mount(list: BlockedPerson[]) {
  const api = { blockedPeople: vi.fn(() => of(list)), unblockPerson: vi.fn(() => of(null)) };
  const toast = { success: vi.fn(), danger: vi.fn() };
  TestBed.configureTestingModule({
    imports: [BlockedPeopleComponent],
    providers: [
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: toast },
      { provide: SessionStore, useValue: { isSignedIn: signal(true), account: signal({ id: 'me-1' }) } },
    ],
  });
  const fixture = TestBed.createComponent(BlockedPeopleComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
  };
  return { fixture, api, toast, el, settle, text: () => el.textContent ?? '' };
}

describe('BlockedPeopleComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('says nobody is blocked when the list is empty', async () => {
    const { text } = await mount([]);
    expect(text()).toContain("You haven't blocked anyone");
  });

  it('lists blocked people and unblocks one with its own button', async () => {
    const { el, api, toast, text, settle } = await mount([person('u-2', 'Mariyam'), person('u-3', 'Aisha')]);
    expect(text()).toContain('Mariyam');
    expect(text()).toContain('Aisha');
    const buttons = Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Unblock');
    expect(buttons).toHaveLength(2);

    buttons[0].click();
    await settle();
    expect(api.unblockPerson).toHaveBeenCalledWith('u-2');
    expect(text()).not.toContain('Mariyam');
    expect(text()).toContain('Aisha');
    expect(toast.success).toHaveBeenCalledWith('Mariyam is unblocked.');
  });
});

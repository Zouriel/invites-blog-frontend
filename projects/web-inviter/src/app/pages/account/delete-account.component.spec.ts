import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { TokenStore } from '../../shared/services/token.store';
import { AccountDeletionSummary } from '../../shared/utils/types/api.types';
import { DeleteAccountComponent } from './delete-account.component';

const summary = (over: Partial<AccountDeletionSummary> = {}): AccountDeletionSummary => ({
  eventsDeleted: 2, eventsPassedOn: 1, albums: 3, photos: 40, videos: 1, paid: ['Premium pass'],
  autoRenews: true, blocked: null, codeChannel: 'email', codeSentTo: 'a•••a@example.com', ...over,
});

function mount(s: AccountDeletionSummary, confirm = of({ deleted: true })) {
  const api = {
    accountDeletionSummary: vi.fn(() => of(s)),
    requestAccountDeletionCode: vi.fn(() => of({ challengeId: 'c1', channel: 'email', sentTo: 'a•••a@example.com', expiresInSeconds: 300 })),
    confirmAccountDeletion: vi.fn(() => confirm),
  };
  const session = { clear: vi.fn() };
  const tokens = { clearAll: vi.fn() };
  const toast = { success: vi.fn(), danger: vi.fn() };
  TestBed.configureTestingModule({
    imports: [DeleteAccountComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: SessionStore, useValue: session },
      { provide: TokenStore, useValue: tokens },
      { provide: UiToastService, useValue: toast },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(DeleteAccountComponent);
  fixture.detectChanges();
  return { fixture, api, session, tokens, toast, navigate, text: () => fixture.nativeElement.textContent as string };
}

describe('DeleteAccountComponent', () => {
  it('says what is deleted, what passes on and what stays, before any code is asked for', () => {
    const { text, api } = mount(summary());
    expect(text()).toContain("can't be undone");
    expect(text()).toContain('paid for is lost');
    expect(text()).toContain('2 events with nobody else on them will be deleted, with 3 albums, guest lists and replies, and 40 photos and 1 video.');
    expect(text()).toContain('1 event is also for other people');
    expect(text()).toContain("Photos and videos you added to other people's events stay");
    expect(text()).toContain('Premium pass');
    expect(text().toLowerCase()).not.toContain('bucket');
    expect(api.requestAccountDeletionCode).not.toHaveBeenCalled();
  });

  it('offers no way to delete when the server says no', () => {
    const { text, fixture } = mount(summary({ blocked: "You're the only admin." }));
    expect(text()).toContain("You're the only admin.");
    expect(fixture.nativeElement.querySelectorAll('ui-button').length).toBe(0);
  });

  it('after the code: clears the session and every event key, and lands home with a confirmation', () => {
    const { fixture, api, session, tokens, toast, navigate } = mount(summary());
    const c = fixture.componentInstance as unknown as { sendCode(): void; setCode(v: string): void; confirm(): void };
    c.sendCode();
    c.setCode('code: 123456 thanks');
    c.confirm();
    expect(api.confirmAccountDeletion).toHaveBeenCalledWith('c1', '123456');
    expect(session.clear).toHaveBeenCalled();
    expect(tokens.clearAll).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Your account has been deleted.');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('keeps the session when the code is refused, and says why', () => {
    const { fixture, session, text } = mount(summary(), throwError(() => new Error('That code is wrong.')));
    const c = fixture.componentInstance as unknown as { sendCode(): void; setCode(v: string): void; confirm(): void };
    c.sendCode();
    c.setCode('000000');
    c.confirm();
    fixture.detectChanges();
    expect(session.clear).not.toHaveBeenCalled();
    expect(text()).toContain('That code is wrong.');
  });
});

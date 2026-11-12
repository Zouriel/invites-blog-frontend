import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { Account } from '../../shared/utils/types/api.types';
import { AccountComponent, nameRefusal } from './account.component';

/** Change your name (owner, 2026-11-12): every account, from the Profile page's Name row. */

// jsdom has no ResizeObserver; some library inputs watch their own size with one.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

const ACCOUNT = { id: 'u1', email: 'aisha@example.com', displayName: 'Aisha', roles: ['Customer'], subscriptionTier: 'Venue' } as unknown as Account;

/** A refusal as ApiService hands it on: the message, the status and the server's errors. */
const refusal = (code: string, message = '') =>
  throwError(() => Object.assign(new Error(message || 'One or more validation errors occurred.'), { status: 400, errors: [{ code, message }] }));

function mount(setName: (name: string) => Observable<Account>) {
  const calls = { setName: vi.fn(setName) };
  // Everything else the page asks for answers with nothing: only the name is under test.
  const api = new Proxy(calls as Record<string, unknown>, {
    get: (target, key: string) => target[key] ?? (() => of(null)),
  });
  const toast = { success: vi.fn(), danger: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    imports: [AccountComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: UiToastService, useValue: toast },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { section: 'profile' }, queryParamMap: convertToParamMap({}), paramMap: convertToParamMap({}) } } },
    ],
  });
  const session = TestBed.inject(SessionStore);
  session.setAccount(ACCOUNT);
  const fixture = TestBed.createComponent(AccountComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
  };
  const cmp = fixture.componentInstance as unknown as {
    openName(): void;
    editName(v: string): void;
    saveName(): void;
    naming(): boolean;
    nameError(): string | null;
    nameReady(): boolean;
  };
  return { fixture, cmp, calls, session, toast, settle };
}

describe('Change your name', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('has a Change button on the Name row that opens the name form, filled with the name', async () => {
    const { fixture, settle } = await mount(() => of(ACCOUNT));
    await settle();
    const row = [...fixture.nativeElement.querySelectorAll('.fact')].find((f) => (f as HTMLElement).textContent!.includes('Name')) as HTMLElement;
    expect(row.textContent).toContain('Aisha');
    const change = [...row.querySelectorAll('button')].find((b) => b.textContent!.includes('Change'))!;
    change.click();
    await settle();
    const input = document.querySelector<HTMLInputElement>('[role=dialog] input')!;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Aisha');
  });

  it('saves the trimmed name, updates the signed-in account everywhere, and closes', async () => {
    const { cmp, calls, session, toast, settle } = await mount((name) => of({ ...ACCOUNT, displayName: name }));
    cmp.openName();
    cmp.editName('  Aisha Ibrahim  ');
    expect(cmp.nameReady()).toBe(true);
    cmp.saveName();
    await settle();
    expect(calls.setName).toHaveBeenCalledWith('Aisha Ibrahim');
    expect(session.account()?.displayName).toBe('Aisha Ibrahim');
    // What isn't in the answer is kept, so nothing else about the session is lost.
    expect(session.account()?.email).toBe('aisha@example.com');
    expect(cmp.naming()).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it("doesn't send an empty name, the same name, or one over 80 characters", async () => {
    const { cmp, calls } = await mount(() => of(ACCOUNT));
    cmp.openName();
    for (const v of ['', '   ', 'Aisha', 'x'.repeat(81)]) {
      cmp.editName(v);
      expect(cmp.nameReady()).toBe(false);
      cmp.saveName();
    }
    expect(calls.setName).not.toHaveBeenCalled();
    cmp.editName('x'.repeat(80));
    expect(cmp.nameReady()).toBe(true);
  });

  it("shows the server's refusal in the form and keeps it until dismissed, the form still open", async () => {
    const said = "That includes words we don't allow on invites.blog. Please change it and try again.";
    const { fixture, cmp, session, settle } = await mount(() => refusal('objectionable_text', said));
    cmp.openName();
    cmp.editName('Something rude');
    cmp.saveName();
    await settle();
    expect(cmp.naming()).toBe(true);
    expect(session.account()?.displayName).toBe('Aisha');
    const alert = document.querySelector('[role=dialog] ui-alert') as HTMLElement;
    expect(alert.textContent).toContain(said);
    // Still there a moment later: a failure is not a toast that fades.
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();
    expect(document.querySelector('[role=dialog] ui-alert')).not.toBeNull();
    (alert.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(cmp.nameError()).toBeNull();
  });

  it('says something for each refusal code when the server sends no words', () => {
    const e = (code: string) => ({ message: 'One or more validation errors occurred.', errors: [{ code }] });
    expect(nameRefusal(e('name_required'))).toBe('Type your name.');
    expect(nameRefusal(e('name_too_long'))).toBe('Up to 80 characters.');
    expect(nameRefusal(e('objectionable_text'))).toBe("That name can't be used. Try another.");
    expect(nameRefusal({ message: 'Offline.' })).toBe('Offline.');
  });
});

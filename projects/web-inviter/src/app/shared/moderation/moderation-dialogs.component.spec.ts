import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../services/session.store';
import { ModerationDialogsComponent } from './moderation-dialogs.component';
import { ModerationStore } from './moderation.store';

const BASE = environment.apiBase;

// jsdom has no ResizeObserver; ui-textarea watches its own size with one.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

function mount() {
  const toast = { success: vi.fn(), danger: vi.fn() };
  const session = { isSignedIn: signal(true), account: signal({ id: 'me-1', displayName: 'Me' }) };
  TestBed.configureTestingModule({
    imports: [ModerationDialogsComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: UiToastService, useValue: toast },
      { provide: SessionStore, useValue: session },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const store = TestBed.inject(ModerationStore);
  const fixture = TestBed.createComponent(ModerationDialogsComponent);
  fixture.detectChanges();
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
    fixture.detectChanges();
  };
  // The modal moves its layer to <body>, so look there rather than inside the fixture.
  const body = () => document.body;
  const button = (label: string) =>
    Array.from(body().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
  return { fixture, http, store, toast, settle, body, button };
}

describe('ModerationDialogsComponent', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('lists the six reasons in plain words, sends the chosen one with the note, and hides the item', async () => {
    const { http, store, settle, body, button } = mount();
    const owner = { userId: 'u-2', name: 'Mariyam' };
    store.askReport({ kind: 'comment', id: 'c-9', noun: 'comment', owner });
    await settle();

    const text = body().textContent ?? '';
    expect(text).toContain('Report this comment');
    for (const label of ['Abusive or bullying', 'Hateful', 'Sexual or nudity', 'Violent or threatening', 'Spam', 'Something else']) {
      expect(text).toContain(label);
    }
    // Nothing to send until a reason is picked.
    expect(button('Send')!.disabled).toBe(true);

    const hateful = body().querySelector<HTMLInputElement>('input[type="radio"][value="hateful"]')!;
    hateful.click();
    const note = body().querySelector<HTMLTextAreaElement>('textarea')!;
    note.value = '  slurs in the second line  ';
    note.dispatchEvent(new Event('input'));
    await settle();
    button('Send')!.click();

    const req = http.expectOne(`${BASE}/api/me/reports`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'comment', targetId: 'c-9', reason: 'hateful', note: 'slurs in the second line' });
    expect(store.isHidden('comment', 'c-9')).toBe(false);
    req.flush({ success: true, data: { hidden: true, message: "Thanks for telling us. It's hidden for you now." } });
    await settle();

    expect(store.isHidden('comment', 'c-9')).toBe(true);
    expect(body().textContent).toContain("It's hidden for you now.");
    // Offered after the report: block the person behind it.
    expect(button('Block Mariyam')).toBeTruthy();
    button('Done')!.click();
    await settle();
    expect(store.reporting()).toBeNull();
  });

  it('keeps a person report on screen when the server does not hide it', async () => {
    const { http, store, settle, body } = mount();
    store.askReport({ kind: 'user', id: 'u-2', noun: 'Mariyam' });
    await settle();
    expect(body().textContent).toContain('Report Mariyam');
    body().querySelector<HTMLInputElement>('input[type="radio"][value="spam"]')!.click();
    await settle();
    Array.from(body().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Send')!.click();
    const req = http.expectOne(`${BASE}/api/me/reports`);
    expect(req.request.body).toEqual({ kind: 'user', targetId: 'u-2', reason: 'spam', note: null });
    req.flush({ success: true, data: { hidden: false, message: "Thanks for telling us. We'll look within 24 hours." } });
    await settle();
    expect(store.isHidden('user', 'u-2')).toBe(false);
  });

  it('offers Block <name> in the form too, for blocking without reporting', async () => {
    const { http, store, settle, button } = mount();
    store.askReport({ kind: 'photo', id: 'p-1', noun: 'photo', owner: { userId: 'u-2', name: 'Mariyam' } });
    await settle();
    button('Block Mariyam')!.click();
    await settle();
    http.expectNone(`${BASE}/api/me/reports`);
    expect(store.reporting()).toBeNull();
    expect(store.blocking()).toEqual({ userId: 'u-2', name: 'Mariyam' });
  });

  it('asks before blocking, and only blocks once confirmed', async () => {
    const { http, store, settle, body, button, toast } = mount();
    store.askBlock({ userId: 'u-2', name: 'Mariyam' });
    await settle();
    expect(body().textContent).toContain('Block Mariyam?');
    expect(body().textContent).toContain("You won't see their posts, comments or photos, and they won't be told.");
    http.expectNone(`${BASE}/api/me/blocks/u-2`);
    expect(store.isBlocked('u-2')).toBe(false);

    button('Block')!.click();
    const req = http.expectOne(`${BASE}/api/me/blocks/u-2`);
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, data: null, message: 'Blocked.' });
    await settle();
    expect(store.isBlocked('u-2')).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it('cancelling the block confirm sends nothing', async () => {
    const { http, store, settle, button } = mount();
    store.askBlock({ userId: 'u-2', name: 'Mariyam' });
    await settle();
    button('Cancel')!.click();
    await settle();
    http.expectNone(`${BASE}/api/me/blocks/u-2`);
    expect(store.blocking()).toBeNull();
    expect(store.isBlocked('u-2')).toBe(false);
  });
});

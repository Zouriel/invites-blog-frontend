import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { ModerationStore } from '../../shared/moderation/moderation.store';
import { SessionStore } from '../../shared/services/session.store';
import { FeedComment, FeedPost } from '../../shared/utils/types/api.types';
import { FeedComponent } from './feed.component';
import { FeedPostComponent } from './feed-post.component';

// jsdom has no ResizeObserver; ui-textarea watches its own size with one.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

const ME = 'me-1';
const OBJECTIONABLE = "That includes words we don't allow on invites.blog. Please change it and try again.";

const post = (over: Partial<FeedPost> = {}): FeedPost => ({
  campaignId: 'camp-1', title: 'Celebration Gala', hostName: 'Hassan', eventStartAt: '2026-11-20T18:00:00Z', venue: null,
  caption: 'Come along', captionIsAuto: false, images: [], imagesAreCover: false, photoCount: 0, likeCount: 0,
  likedByMe: false, commentCount: 2, role: 'guest', canModerate: false, link: '/invitation/camp-1',
  lastActivityAt: '2026-11-01T10:00:00Z', hostUserId: 'host-1', ...over,
});

const comment = (over: Partial<FeedComment> = {}): FeedComment => ({
  id: 'c-1', parentId: null, authorName: 'Mariyam', authorIsHost: false, body: 'Lovely', createdAt: '2026-11-01T10:00:00Z',
  likeCount: 0, likedByMe: false, canDelete: false, replies: [], authorId: 'u-2', ...over,
});

function setup(comments: FeedComment[] = []) {
  const api = {
    feedComments: vi.fn(() => of(comments)),
    addFeedComment: vi.fn(),
    setFeedCaption: vi.fn(),
    reportContent: vi.fn(() => of({ hidden: true, message: 'Hidden for you now.' })),
    blockPerson: vi.fn(() => of(null)),
    feed: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: SessionStore, useValue: { isSignedIn: signal(true), account: signal({ id: ME, displayName: 'Me' }) } },
      { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
    ],
  });
  return { api, store: TestBed.inject(ModerationStore) };
}

async function render(p: FeedPost) {
  const fixture = TestBed.createComponent(FeedPostComponent);
  fixture.componentRef.setInput('post', p);
  fixture.detectChanges();
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  };
  return { fixture, el, settle, text: () => el.textContent ?? '' };
}

describe('FeedPostComponent: report and block', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("offers Report post, Report and Block the host on someone else's post, from its menu", async () => {
    setup();
    const { el, settle } = await render(post());
    const trigger = el.querySelector<HTMLButtonElement>('button[aria-label="More options for this post"]');
    expect(trigger).toBeTruthy();
    trigger!.click();
    await settle();
    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent?.trim());
    expect(items).toEqual(['Report post', 'Report Hassan', 'Block Hassan']);
  });

  it('has no menu on your own post', async () => {
    setup();
    const { el } = await render(post({ hostUserId: ME, role: 'host' }));
    expect(el.querySelector('button[aria-label="More options for this post"]')).toBeNull();
  });

  it("puts a menu on other people's comments and replies, not on your own", async () => {
    setup([
      comment({ id: 'c-1', authorId: 'u-2', replies: [comment({ id: 'r-1', parentId: 'c-1', authorId: ME, authorName: 'Me', canDelete: true })] }),
      comment({ id: 'c-2', authorId: ME, authorName: 'Me', canDelete: true }),
    ]);
    const { el } = await render(post());
    const labels = Array.from(el.querySelectorAll('button[aria-label^="More options for"]')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['More options for this post', 'More options for Mariyam’s comment']);
  });

  it('opens the report dialog on the comment with its author to block', async () => {
    const { store } = setup([comment()]);
    const { fixture } = await render(post());
    (fixture.componentInstance as unknown as { onCommentMenu: (c: FeedComment, i: { value: string; label: string }) => void })
      .onCommentMenu(comment(), { value: 'report', label: 'Report comment' });
    expect(store.reporting()).toEqual({ kind: 'comment', id: 'c-1', noun: 'comment', owner: { userId: 'u-2', name: 'Mariyam' } });
  });

  it('takes a reported comment off the screen as soon as the server hides it', async () => {
    const { store, api } = setup([comment({ id: 'c-1', body: 'First' }), comment({ id: 'c-2', body: 'Second', authorId: 'u-3' })]);
    const { text, settle } = await render(post());
    expect(text()).toContain('First');
    await store.report({ kind: 'comment', id: 'c-1', noun: 'comment' }, 'abusive', '');
    await settle();
    expect(api.reportContent).toHaveBeenCalledWith('comment', 'c-1', 'abusive', null);
    expect(text()).not.toContain('First');
    expect(text()).toContain('Second');
  });

  it("takes a blocked person's comments and replies off the screen", async () => {
    const { store } = setup([
      comment({ id: 'c-1', body: 'From Mariyam', authorId: 'u-2' }),
      comment({ id: 'c-2', body: 'From Aisha', authorId: 'u-3', authorName: 'Aisha', replies: [comment({ id: 'r-1', parentId: 'c-2', body: 'Reply by Mariyam', authorId: 'u-2' })] }),
    ]);
    const { text, settle } = await render(post());
    expect(text()).toContain('Reply by Mariyam');
    await store.block({ userId: 'u-2', name: 'Mariyam' });
    await settle();
    expect(text()).not.toContain('From Mariyam');
    expect(text()).not.toContain('Reply by Mariyam');
    expect(text()).toContain('From Aisha');
  });

  it("shows the server's objectionable_text refusal under the comment box", async () => {
    const { api } = setup();
    api.addFeedComment.mockReturnValue(throwError(() => Object.assign(new Error(OBJECTIONABLE), { status: 400 })));
    const { fixture, el, settle, text } = await render(post({ commentCount: 0 }));
    const cmp = fixture.componentInstance as unknown as { setDraft: (t: string) => void; send: () => void };
    cmp.setDraft('something rude');
    cmp.send();
    await settle();
    expect(el.querySelector('.composer ui-alert')?.textContent).toContain(OBJECTIONABLE);
    // Editing the comment clears it.
    cmp.setDraft('something kind');
    await settle();
    expect(text()).not.toContain(OBJECTIONABLE);
  });

  it("shows the server's objectionable_text refusal under the caption", async () => {
    const { api } = setup();
    api.setFeedCaption.mockReturnValue(throwError(() => Object.assign(new Error(OBJECTIONABLE), { status: 400 })));
    const { fixture, el, settle } = await render(post({ commentCount: 0, canModerate: true, role: 'host', hostUserId: ME }));
    const cmp = fixture.componentInstance as unknown as { startEdit: () => void; saveCaption: () => void };
    cmp.startEdit();
    cmp.saveCaption();
    await settle();
    expect(el.querySelector('.caption-block ui-form-field')?.textContent).toContain(OBJECTIONABLE);
  });
});

describe('FeedPostComponent: the Studio badge (the organiser\'s picture and name)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows no tag for an event whose organiser is not on Studio (the place text is something else)', async () => {
    setup();
    const { el } = await render(post({ venue: 'Male City Hall' }));
    expect(el.querySelector('ui-avatar-tag')).toBeNull();
  });

  it("shows the organiser's name with no prefix, and their first letter when there is no picture", async () => {
    setup();
    const { el } = await render(post({ venueName: 'Coral Events', venueLogoUrl: null }));
    const tag = el.querySelector<HTMLElement>('.media ui-avatar-tag')!;
    expect(tag).not.toBeNull();
    expect(tag.getAttribute('aria-label')).toBe('Coral Events');
    expect(tag.querySelector('.name')?.textContent?.trim()).toBe('Coral Events');
    expect(tag.querySelector('img')).toBeNull();
    expect(tag.querySelector('.letter')?.textContent?.trim()).toBe('C');
    expect(tag.textContent ?? '').not.toMatch(/\bAt\b/);
  });

  it("shows the organiser's profile picture when there is one", async () => {
    setup();
    const { el } = await render(post({ venueName: 'Coral Events', venueLogoUrl: 'https://cdn.example/me.jpg' }));
    const tag = el.querySelector<HTMLElement>('.media ui-avatar-tag')!;
    expect(tag.getAttribute('aria-label')).toBe('Coral Events');
    expect(tag.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/me.jpg');
    expect(tag.querySelector('.letter')).toBeNull();
  });

  it('puts the tag at the top corner, plain over the blank header and as an overlay on a photo', async () => {
    setup();
    const { fixture, el, settle } = await render(post({ venueName: 'Kurumba', venueLogoUrl: null, images: [{ url: 'https://cdn.example/p.jpg', isVideo: false }] }));
    const tag = () => el.querySelector<HTMLElement>('.media ui-avatar-tag')!;
    expect(tag().getAttribute('aria-label')).toBe('Kurumba');
    // The photo hasn't loaded (jsdom never loads one): the header is blank, the tag plain.
    expect(tag().querySelector('[data-variant]')?.getAttribute('data-variant')).toBe('plain');
    // Once the photo is there, the tag sits on it.
    (fixture.componentInstance as unknown as { loaded: { set(v: Set<string>): void } }).loaded.set(new Set(['https://cdn.example/p.jpg']));
    await settle();
    expect(tag().querySelector('[data-variant]')?.getAttribute('data-variant')).toBe('overlay');
  });
});

describe('FeedComponent: report and block', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("removes a hidden post and a blocked host's posts from the feed", async () => {
    const { api, store } = setup();
    api.feed.mockReturnValue(
      of({
        items: [
          post({ campaignId: 'a', title: 'Alpha night', commentCount: 0 }),
          post({ campaignId: 'b', title: 'Beta night', hostUserId: 'host-2', commentCount: 0 }),
          post({ campaignId: 'c', title: 'Gamma night', hostUserId: 'host-3', commentCount: 0 }),
        ],
        hasMore: false,
      }),
    );
    const fixture = TestBed.createComponent(FeedComponent);
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('Alpha night');

    await store.report({ kind: 'post', id: 'a', noun: 'post' }, 'spam', '');
    fixture.detectChanges();
    expect(text()).not.toContain('Alpha night');

    await store.block({ userId: 'host-2', name: 'Hassan' });
    fixture.detectChanges();
    expect(text()).not.toContain('Beta night');
    expect(text()).toContain('Gamma night');
  });
});

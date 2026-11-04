import { EventDayPipe } from '../../shared/pipes/event-time.pipe';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';
import { UiAlert } from '@zouriel/ui/alert';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiFormField, UiTextarea } from '@zouriel/ui/form';
import { UiMenu, UiMenuItem } from '@zouriel/ui/overlay';
import { UiCarousel, UiCarouselSlide } from '@zouriel/ui/media';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { BlockTarget, ModerationStore } from '../../shared/moderation/moderation.store';
import { FeedComment, FeedPost } from '../../shared/utils/types/api.types';

/** How many top-level comments show before "View all". */
const PREVIEW = 2;

/**
 * One event as a post: its pictures, its words, and the conversation under it.
 *
 * <p>Everything here is optimistic where it is cheap to undo (a like flips at once and flips back if
 * the server says no) and waits where it isn't (a comment appears once it is saved, so nobody reads
 * a reply that never existed).</p>
 */
@Component({
  selector: 'app-feed-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EventDayPipe, 
    FormsModule, NgTemplateOutlet, RouterLink, HugeiconsIconComponent,
    UiAlert, UiAvatar, UiButton, UiCarousel, UiFormField, UiIconButton, UiMenu, UiTextarea,
  ],
  templateUrl: './feed-post.component.html',
  styleUrl: './feed-post.component.scss',
})
export class FeedPostComponent {
  private readonly api = inject(ApiService);
  private readonly mod = inject(ModerationStore);

  readonly post = input.required<FeedPost>();

  protected readonly icons = APP_ICONS;

  protected readonly heartIcon = FavouriteIcon;
  protected readonly commentIcon = BubbleChatIcon;

  /** The post as it stands after this reader's own likes, comments and edits. */
  private readonly local = signal<Partial<FeedPost>>({});
  protected readonly p = computed<FeedPost>(() => ({ ...this.post(), ...this.local() }));

  /**
   * Pictures that failed to load. A cover can point at a file that is gone, and a carousel of
   * broken-image icons is worse than the plain initial, so each picture is tried before it is shown.
   */
  private readonly broken = signal(new Set<string>());
  private readonly loaded = signal(new Set<string>());

  /** The picture showing, shared with the carousel so the counter and dots follow a swipe. */
  protected readonly slide = signal(0);

  protected readonly slides = computed<UiCarouselSlide[]>(() =>
    this.p()
      .images.filter((img) => this.loaded().has(img.url) && !this.broken().has(img.url))
      .map((img, i) => ({ image: img.url, alt: `${this.p().title}, picture ${i + 1}` })),
  );

  /** Still trying at least one picture: hold the space rather than flash the initial. */
  protected readonly probing = computed(() =>
    this.p().images.some((img) => !this.loaded().has(img.url) && !this.broken().has(img.url)),
  );

  private probe(urls: string[]): void {
    if (typeof Image === 'undefined') return;
    for (const url of urls) {
      // A template's page is not a picture.
      if (url.endsWith('.html')) {
        this.broken.update((set) => new Set(set).add(url));
        continue;
      }
      const img = new Image();
      img.onload = () => this.loaded.update((set) => new Set(set).add(url));
      img.onerror = () => this.broken.update((set) => new Set(set).add(url));
      img.src = url;
    }
  }

  protected readonly roleLabel = computed(() => {
    switch (this.p().role) {
      case 'host':
        return 'Hosting';
      case 'manager':
        return 'Organising';
      case 'celebrant':
        return 'Your event';
      default:
        return 'Invited';
    }
  });

  protected readonly openLabel = computed(() => (this.p().role === 'guest' ? 'Open invitation' : 'Open event'));

  /* ---- likes ---- */

  protected togglePostLike(): void {
    const before = this.p();
    const liked = !before.likedByMe;
    this.local.update((l) => ({ ...l, likedByMe: liked, likeCount: before.likeCount + (liked ? 1 : -1) }));
    this.api.likeFeedPost(before.campaignId, liked).subscribe({
      next: (s) => this.local.update((l) => ({ ...l, likedByMe: s.likedByMe, likeCount: s.likeCount })),
      error: () => this.local.update((l) => ({ ...l, likedByMe: before.likedByMe, likeCount: before.likeCount })),
    });
  }

  /* ---- caption ---- */

  protected readonly editing = signal(false);
  protected readonly draftCaption = signal('');
  protected readonly savingCaption = signal(false);
  /** Why the server refused the caption (a word we don't allow), shown under the field. */
  protected readonly captionError = signal<string | null>(null);
  /** Long captions fold after a few lines, the way a feed does. */
  protected readonly captionOpen = signal(false);

  protected startEdit(): void {
    this.draftCaption.set(this.p().captionIsAuto ? '' : (this.p().caption ?? ''));
    this.captionError.set(null);
    this.editing.set(true);
  }

  protected saveCaption(): void {
    this.savingCaption.set(true);
    const text = this.draftCaption().trim();
    this.api.setFeedCaption(this.p().campaignId, text || null).subscribe({
      next: (updated) => {
        this.local.update((l) => ({ ...l, caption: updated.caption, captionIsAuto: updated.captionIsAuto }));
        this.savingCaption.set(false);
        this.editing.set(false);
      },
      error: (err: Error) => {
        this.captionError.set(err.message);
        this.savingCaption.set(false);
      },
    });
  }

  /* ---- comments ---- */

  protected readonly comments = signal<FeedComment[] | null>(null);
  protected readonly loadingComments = signal(false);
  protected readonly showAll = signal(false);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly replyTo = signal<FeedComment | null>(null);
  /** Why the server refused the comment (a word we don't allow), shown under the box. */
  protected readonly commentError = signal<string | null>(null);

  /**
   * The conversation less what this reader reported (and the server hid for them) or whose author
   * they blocked, both of which leave the screen at once. A hidden comment takes its replies with it.
   */
  private readonly keptComments = computed(() =>
    (this.comments() ?? [])
      .filter((c) => this.kept(c))
      .map((c) => ({ ...c, replies: c.replies.filter((r) => this.kept(r)) })),
  );

  private kept(c: FeedComment): boolean {
    return !this.mod.isHidden('comment', c.id) && !this.mod.isBlocked(c.authorId);
  }

  protected readonly visibleComments = computed(() => {
    const list = this.keptComments();
    return this.showAll() ? list : list.slice(-PREVIEW);
  });
  protected readonly hiddenCount = computed(() => {
    if (this.comments() === null) return this.p().commentCount;
    return this.showAll() ? 0 : Math.max(0, this.keptComments().length - PREVIEW);
  });

  constructor() {
    queueMicrotask(() => {
      this.probe(this.post().images.map((img) => img.url));
      if (this.post().commentCount > 0) this.loadComments();
    });
  }

  private loadComments(): void {
    this.loadingComments.set(true);
    this.api.feedComments(this.p().campaignId).subscribe({
      next: (list) => {
        this.comments.set(list);
        this.loadingComments.set(false);
      },
      error: () => this.loadingComments.set(false),
    });
  }

  protected viewAll(): void {
    this.showAll.set(true);
    if (this.comments() === null) this.loadComments();
  }

  protected focusComposer(el: HTMLElement): void {
    el.querySelector('textarea')?.focus();
  }

  protected reply(c: FeedComment, composer: HTMLElement): void {
    this.replyTo.set(c);
    this.focusComposer(composer);
  }

  protected send(): void {
    const body = this.draft().trim();
    if (!body || this.sending()) return;
    this.sending.set(true);
    const parent = this.replyTo();
    this.api.addFeedComment(this.p().campaignId, body, parent?.id ?? null).subscribe({
      next: (saved) => {
        this.comments.update((list) => {
          const all = list ?? [];
          if (!saved.parentId) return [...all, saved];
          return all.map((c) => (c.id === saved.parentId ? { ...c, replies: [...c.replies, saved] } : c));
        });
        this.local.update((l) => ({ ...l, commentCount: this.p().commentCount + 1 }));
        this.draft.set('');
        this.replyTo.set(null);
        this.commentError.set(null);
        this.sending.set(false);
      },
      error: (err: Error) => {
        this.commentError.set(err.message);
        this.sending.set(false);
      },
    });
  }

  protected setDraft(text: string): void {
    this.draft.set(text);
    if (this.commentError()) this.commentError.set(null);
  }

  /* ---- report and block ---- */

  /** The host, as someone who can be reported or blocked, when the post says who they are. */
  private readonly host = computed<BlockTarget | null>(() => {
    const post = this.p();
    return post.hostUserId ? { userId: post.hostUserId, name: post.hostName || 'the host' } : null;
  });

  /**
   * The post's "more" menu: report the post, and report or block its host. Only on someone else's
   * post, and only signed in (the feed always is). Without the host's id, the reader's own role says
   * whether it is theirs.
   */
  protected readonly postMenu = computed<UiMenuItem[]>(() => {
    if (!this.mod.canReport()) return [];
    const post = this.p();
    const host = this.host();
    if (host ? !this.mod.isOthers(host.userId) : post.role === 'host') return [];
    const items: UiMenuItem[] = [{ label: 'Report post', value: 'report' }];
    if (host) {
      items.push({ label: `Report ${host.name}`, value: 'report-person' });
      items.push({ label: `Block ${host.name}`, value: 'block', danger: true });
    }
    return items;
  });

  protected onPostMenu(item: UiMenuItem): void {
    const host = this.host();
    if (item.value === 'report') {
      this.mod.askReport({ kind: 'post', id: this.p().campaignId, noun: 'post', owner: host });
    } else if (item.value === 'report-person' && host) {
      this.mod.askReport({ kind: 'user', id: host.userId, noun: host.name, owner: host });
    } else if (item.value === 'block' && host) {
      this.mod.askBlock(host);
    }
  }

  /** Each comment's menu, worked out once per change rather than on every check. */
  protected readonly commentMenus = computed(() => {
    const menus = new Map<string, UiMenuItem[]>();
    if (!this.mod.canReport()) return menus;
    for (const c of this.keptComments()) {
      for (const x of [c, ...c.replies]) menus.set(x.id, this.commentItems(x));
    }
    return menus;
  });

  /** Someone else's comment: by its author's id, or (an older server) by not being removable as yours. */
  private commentItems(c: FeedComment): UiMenuItem[] {
    if (c.authorId ? !this.mod.isOthers(c.authorId) : c.canDelete) return [];
    const items: UiMenuItem[] = [{ label: 'Report comment', value: 'report' }];
    if (c.authorId) {
      items.push({ label: `Report ${c.authorName}`, value: 'report-person' });
      items.push({ label: `Block ${c.authorName}`, value: 'block', danger: true });
    }
    return items;
  }

  protected onCommentMenu(c: FeedComment, item: UiMenuItem): void {
    const author: BlockTarget | null = c.authorId ? { userId: c.authorId, name: c.authorName } : null;
    if (item.value === 'report') {
      this.mod.askReport({ kind: 'comment', id: c.id, noun: 'comment', owner: author });
    } else if (item.value === 'report-person' && author) {
      this.mod.askReport({ kind: 'user', id: author.userId, noun: author.name, owner: author });
    } else if (item.value === 'block' && author) {
      this.mod.askBlock(author);
    }
  }

  /** Enter sends; Shift+Enter is a new line. */
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  protected toggleCommentLike(c: FeedComment): void {
    const liked = !c.likedByMe;
    const patch = (likedByMe: boolean, likeCount: number) =>
      this.comments.update((list) => (list ?? []).map((x) => this.patchComment(x, c.id, { likedByMe, likeCount })));
    patch(liked, c.likeCount + (liked ? 1 : -1));
    this.api.likeFeedComment(this.p().campaignId, c.id, liked).subscribe({
      next: (s) => patch(s.likedByMe, s.likeCount),
      error: () => patch(c.likedByMe, c.likeCount),
    });
  }

  protected remove(c: FeedComment): void {
    this.api.deleteFeedComment(this.p().campaignId, c.id).subscribe({
      next: () => {
        const removed = 1 + (c.parentId ? 0 : c.replies.length);
        this.comments.update((list) =>
          (list ?? [])
            .filter((x) => x.id !== c.id)
            .map((x) => ({ ...x, replies: x.replies.filter((r) => r.id !== c.id) })),
        );
        this.local.update((l) => ({ ...l, commentCount: Math.max(0, this.p().commentCount - removed) }));
        if (this.replyTo()?.id === c.id) this.replyTo.set(null);
      },
    });
  }

  private patchComment(x: FeedComment, id: string, patch: Partial<FeedComment>): FeedComment {
    if (x.id === id) return { ...x, ...patch };
    return { ...x, replies: x.replies.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
  }

  /** "now", "5m", "3h", "2d", then the date. */
  protected ago(iso: string): string {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  protected initial(title: string): string {
    return (title?.trim()[0] ?? '?').toUpperCase();
  }
}

import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiTextarea } from '@zouriel/ui/form';
import { UiCarousel, UiCarouselSlide } from '@zouriel/ui/media';
import { ApiService } from '../../../shared/api/api.service';
import { FeedComment, FeedPost } from '../../../shared/utils/types/api.types';

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
  imports: [DatePipe, FormsModule, NgTemplateOutlet, RouterLink, HugeiconsIconComponent, UiAvatar, UiButton, UiCarousel, UiTextarea],
  templateUrl: './feed-post.component.html',
  styleUrl: './feed-post.component.scss',
})
export class FeedPostComponent {
  private readonly api = inject(ApiService);

  readonly post = input.required<FeedPost>();

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
  /** Long captions fold after a few lines, the way a feed does. */
  protected readonly captionOpen = signal(false);

  protected startEdit(): void {
    this.draftCaption.set(this.p().captionIsAuto ? '' : (this.p().caption ?? ''));
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
      error: () => this.savingCaption.set(false),
    });
  }

  /* ---- comments ---- */

  protected readonly comments = signal<FeedComment[] | null>(null);
  protected readonly loadingComments = signal(false);
  protected readonly showAll = signal(false);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly replyTo = signal<FeedComment | null>(null);

  protected readonly visibleComments = computed(() => {
    const list = this.comments() ?? [];
    return this.showAll() ? list : list.slice(-PREVIEW);
  });
  protected readonly hiddenCount = computed(() => {
    if (this.comments() === null) return this.p().commentCount;
    return this.showAll() ? 0 : Math.max(0, (this.comments() ?? []).length - PREVIEW);
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
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
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

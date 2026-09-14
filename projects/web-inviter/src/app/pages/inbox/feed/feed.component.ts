import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../../shared/api/api.service';
import { FeedPost } from '../../../shared/utils/types/api.types';
import { FeedPostComponent } from './feed-post.component';

const PAGE = 10;

/**
 * The home feed: every event this account is part of, told as a post, the latest news first.
 *
 * <p>This is the "blog" of invites.blog. Hosting, being celebrated and being a guest all land here
 * the same way, so the page reads as one stream of what is happening in your circle rather than
 * three lists of things you have to go and check.</p>
 */
@Component({
  selector: 'app-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState, UiSpinner, FeedPostComponent],
  template: `
    @if (loading()) {
      <div class="centered"><ui-spinner /></div>
    } @else if (!posts().length) {
      <ui-empty-state
        heading="Nothing in your feed yet"
        description="Events you host, and the ones you're invited to, show up here as posts with their photos and comments."
      >
        <a empty-actions routerLink="/events/new"><ui-button variant="primary">Start an event</ui-button></a>
      </ui-empty-state>
    } @else {
      <div class="feed">
        @for (p of posts(); track p.campaignId) {
          <app-feed-post [post]="p" />
        }
        @if (hasMore()) {
          <div class="more">
            <ui-button variant="outline" [loading]="loadingMore()" (click)="more()">Load older posts</ui-button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .centered { display: flex; justify-content: center; padding: 3rem 0; }
    .feed {
      display: flex;
      flex-direction: column;
      max-width: 36rem;
      margin: 0 auto;
    }
    /* A hairline between one event and the next, and room either side of it. */
    app-feed-post + app-feed-post {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--ui-color-border);
    }
    .more { display: flex; justify-content: center; padding-block: 0.5rem 1rem; }
  `,
})
export class FeedComponent {
  private readonly api = inject(ApiService);

  protected readonly posts = signal<FeedPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);

  constructor() {
    this.api.feed(0, PAGE).subscribe({
      next: (page) => {
        this.posts.set(page.items);
        this.hasMore.set(page.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected more(): void {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    this.api.feed(this.posts().length, PAGE).subscribe({
      next: (page) => {
        // A post can move between pages when something new happens on it; keep the first copy.
        const seen = new Set(this.posts().map((p) => p.campaignId));
        this.posts.update((list) => [...list, ...page.items.filter((p) => !seen.has(p.campaignId))]);
        this.hasMore.set(page.hasMore);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }
}

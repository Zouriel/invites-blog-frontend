import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState, UiStarterCard } from '@zouriel/ui/feedback';
import { EmptyArtComponent } from '../../shared/guidance/empty-art.component';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../shared/api/api.service';
import { ModerationStore } from '../../shared/moderation/moderation.store';
import { FeedPost } from '../../shared/utils/types/api.types';
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
  imports: [EmptyArtComponent, HugeiconsIconComponent, UiButton, UiEmptyState, UiStarterCard, UiSpinner, FeedPostComponent],
  template: `
    @if (loading()) {
      <div class="centered"><ui-spinner /></div>
    } @else if (!shown().length) {
      <ui-empty-state heading="Your feed is quiet" description="Events you host or are invited to show up here.">
        <app-empty-art empty-art key="feed" />
        <div empty-starters>
          <ui-starter-card heading="Start an event" description="Pick a design, add guests, send." (pressed)="go('/events/new')">
            <hugeicons-icon starter-icon [icon]="icons.add" [size]="20" [strokeWidth]="1.8" />
          </ui-starter-card>
          <ui-starter-card heading="See an example event" description="A made-up wedding, to look around." (pressed)="go('/example-event')">
            <hugeicons-icon starter-icon [icon]="icons.example" [size]="20" [strokeWidth]="1.8" />
          </ui-starter-card>
          <ui-starter-card heading="Browse templates" description="Designs for every occasion." (pressed)="go('/feed', { tab: 'templates' })">
            <hugeicons-icon starter-icon [icon]="icons.templates" [size]="20" [strokeWidth]="1.8" />
          </ui-starter-card>
        </div>
      </ui-empty-state>
    } @else {
      <div class="feed">
        @for (p of shown(); track p.campaignId) {
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
  private readonly mod = inject(ModerationStore);
  private readonly router = inject(Router);
  protected readonly icons = APP_ICONS;

  protected go(path: string, queryParams?: Record<string, string>): void {
    void this.router.navigate([path], { queryParams });
  }

  protected readonly posts = signal<FeedPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);

  /**
   * The posts less what this reader reported (and the server hid for them) and the events of anyone
   * they blocked: both leave the screen the moment it happens, and the server leaves them out of
   * every later page.
   */
  protected readonly shown = computed(() =>
    this.posts().filter((p) => !this.mod.isHidden('post', p.campaignId) && !this.mod.isBlocked(p.hostUserId)),
  );

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

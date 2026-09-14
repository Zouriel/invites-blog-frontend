import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { EventPhoto } from '../utils/types/api.types';

/**
 * Picks the photos that head the event's post in everyone's feed, from its default bucket.
 *
 * <p>Tap to pick, tap again to drop. The number on each pick is where it shows, so the first one
 * tapped is the first picture people see. With nothing picked the post uses the bucket's first
 * photos, which is what most events want until the good ones are in.</p>
 */
@Component({
  selector: 'app-feed-covers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiEmptyState, UiSpinner],
  template: `
    @if (loading()) {
      <div class="centered"><ui-spinner /></div>
    } @else if (!photos().length) {
      <ui-empty-state
        heading="No photos yet"
        description="Once photos are added to this event's main bucket, you can pick the ones that head its post in the feed."
      />
    } @else {
      <p class="lead">
        Pick up to {{ max() }}. They show in the order you pick them. With none picked, the post uses the first photos
        added.
      </p>

      <div class="grid" role="listbox" aria-multiselectable="true" aria-label="Photos in the main bucket">
        @for (p of photos(); track p.id) {
          @let at = picked().indexOf(p.id);
          <button
            type="button"
            class="tile"
            role="option"
            [class.tile--on]="at >= 0"
            [class.tile--full]="at < 0 && full()"
            [attr.aria-selected]="at >= 0"
            [attr.aria-label]="(at >= 0 ? 'Cover ' + (at + 1) + ', ' : '') + 'photo by ' + (p.uploaderName || 'a guest')"
            (click)="toggle(p.id)"
          >
            <img [src]="p.thumbUrl" alt="" loading="lazy" decoding="async" />
            @if (p.contentType.startsWith('video/')) {
              <span class="tile__video" aria-hidden="true">▶</span>
            }
            @if (at >= 0) {
              <span class="tile__n">{{ at + 1 }}</span>
            }
          </button>
        }
      </div>
    }

    <div class="foot">
      @if (picked().length) {
        <ui-button variant="ghost" (click)="picked.set([])">Clear</ui-button>
      }
      <span class="foot__count">{{ picked().length }} / {{ max() }}</span>
      <ui-button variant="outline" (click)="closed.emit()">Cancel</ui-button>
      <ui-button variant="primary" [loading]="saving()" [disabled]="loading()" (click)="save()">Save</ui-button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .centered { display: flex; justify-content: center; padding: 2.5rem 0; }
    .lead { margin: 0 0 1rem; color: var(--ui-color-text-muted); font-size: 0.9rem; max-width: 60ch; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
      gap: 0.4rem;
      max-height: min(60vh, 34rem);
      overflow-y: auto;
      padding: 2px;
    }
    .tile {
      position: relative;
      aspect-ratio: 1;
      padding: 0;
      border: 0;
      border-radius: var(--ui-radius);
      overflow: hidden;
      background: var(--ui-color-surface-subtle);
      cursor: pointer;
    }
    .tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.15s ease, opacity 0.15s ease; }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile--on { box-shadow: inset 0 0 0 3px var(--ui-color-primary); }
    .tile--on img { transform: scale(0.9); border-radius: calc(var(--ui-radius) - 2px); }
    .tile--full img { opacity: 0.45; }
    .tile__n {
      position: absolute;
      top: 0.35rem;
      right: 0.35rem;
      display: grid;
      place-items: center;
      min-width: 1.5rem;
      height: 1.5rem;
      padding-inline: 0.3rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
    }
    .tile__video {
      position: absolute;
      left: 0.4rem;
      bottom: 0.3rem;
      font-size: 0.75rem;
      color: var(--ui-media-on-scrim);
      text-shadow: 0 1px 3px var(--ui-media-scrim);
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1.25rem;
    }
    .foot__count {
      margin-right: auto;
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
      color: var(--ui-color-text-muted);
    }
  `,
})
export class FeedCoversComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();
  readonly closed = output<void>();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly photos = signal<EventPhoto[]>([]);
  protected readonly picked = signal<string[]>([]);
  protected readonly max = signal(6);
  protected readonly full = computed(() => this.picked().length >= this.max());

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api.feedCovers(this.campaignId()).subscribe({
      next: (covers) => {
        this.max.set(covers.max);
        this.picked.set(covers.photoIds);
        if (!covers.bucketId) {
          this.loading.set(false);
          return;
        }
        this.api.mediaBucketMedia(covers.bucketId).subscribe({
          next: (box) => {
            this.photos.set(box.photos);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggle(id: string): void {
    this.picked.update((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      return list.length >= this.max() ? list : [...list, id];
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.api.setFeedCovers(this.campaignId(), this.picked()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.picked().length ? 'Cover photos saved.' : 'The post will use the first photos.');
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}

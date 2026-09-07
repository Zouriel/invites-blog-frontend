import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { ApiService } from '../../shared/api/api.service';
import { BucketCodeComponent } from '../../shared/bucket-code/bucket-code.component';
import { BucketSizeComponent } from '../../shared/bucket-size/bucket-size.component';
import { PhotoBoxComponent } from '../../shared/photo-box/photo-box.component';
import { MediaBucket } from '../../shared/utils/types/api.types';

/**
 * One media bucket on a page of its own.
 *
 * <p>Where a bucket lives when its event has no invitation to hang it off. A bucket belonging to an
 * event that IS being invited to shows the same controls on that event's dashboard instead — a host
 * running a party should not have to go somewhere else to print the code for it — which is why the
 * panels are a shared component rather than this page's own.</p>
 */
@Component({
  selector: 'app-media-bucket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, UiAlert, UiBadge, UiSpinner, UiTab, UiTabs, UiText,
    BucketCodeComponent, BucketSizeComponent, PhotoBoxComponent,
  ],
  templateUrl: './media-bucket.component.html',
  styleUrl: './media-bucket.component.scss',
})
export class MediaBucketComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly bucketId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly bucket = signal<MediaBucket | null>(null);

  /**
   * Every bucket on this event that the viewer may look into — this one among them.
   *
   * <p>An event can hold several once its owner subscribes, and they are one night's worth of the
   * same party rather than separate places to go. So they are TABS here: the ceremony and the
   * after-party sit side by side, and moving between them does not mean going back to a list. A
   * guest sees only the ones they were admitted to, so this can legitimately come back with one.</p>
   */
  protected readonly siblings = signal<MediaBucket[]>([]);

  protected readonly activeIndex = signal(0);

  /** Swaps the page over to another of the event's buckets without a navigation. */
  protected showBucket(index: number): void {
    const next = this.siblings()[index];
    if (!next) return;
    this.activeIndex.set(index);
    this.bucket.set(next);
  }

  // ngOnInit, not the constructor: an input has no value until after construction, so this would
  // otherwise load the bucket with an empty id.
  ngOnInit(): void {
    this.api.mediaBucket(this.bucketId()).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.loading.set(false);
        this.loadSiblings(bucket);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSiblings(bucket: MediaBucket): void {
    this.api.visibleBuckets(bucket.campaignId).subscribe({
      next: (list) => {
        // Only worth tabs when there is more than one; a single tab is a heading with a box round it.
        if (list.length < 2) return;
        this.siblings.set(list);
        this.activeIndex.set(Math.max(0, list.findIndex((b) => b.id === bucket.id)));
      },
      error: () => this.siblings.set([]),
    });
  }
}

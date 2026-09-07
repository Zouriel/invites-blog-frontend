import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiModal, UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { MediaBucket, MediaBucketPlan } from '../utils/types/api.types';
import { SessionStore } from '../services/session.store';

/**
 * How full a bucket is, and how to make it bigger — as a bar rather than a card.
 *
 * <p>It sits above the media grid, where somebody is looking at the photographs rather than
 * administering the thing holding them. A card there would claim the attention of a section when
 * what it actually is is a status line with one control on it; the grid is the content of that tab.
 * The choosing itself is a dialog, because picking a size is a decision and not a glance.</p>
 */
@Component({
  selector: 'app-bucket-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, UiButton, UiFormField, UiInput, UiModal],
  templateUrl: './bucket-size.component.html',
  styleUrl: './bucket-size.component.scss',
})
export class BucketSizeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly bucketId = input.required<string>();

  /** Given by whoever already loaded it, so the page does not fetch the same bucket twice. */
  readonly initial = input<MediaBucket | null>(null);

  protected readonly bucket = signal<MediaBucket | null>(null);
  protected readonly plans = signal<MediaBucketPlan[]>([]);
  protected readonly sizing = signal(false);
  protected readonly resizing = signal(false);

  private readonly session = inject(SessionStore);

  protected readonly renaming = signal(false);
  protected readonly saving = signal(false);
  protected draftName = '';

  /**
   * Opens the rename box, or says why it cannot be used.
   *
   * <p>Checked here rather than by hiding the control. Somebody who cannot rename a bucket still
   * benefits from knowing the name is a thing that exists and what it would be for.</p>
   */
  protected startRename(bucket: MediaBucket): void {
    if (!this.session.isSubscriber()) {
      this.toast.info('Naming your buckets is part of a subscription.');
      return;
    }
    this.draftName = bucket.name;
    this.renaming.set(true);
  }

  protected saveName(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.renameMediaBucket(this.bucketId(), this.draftName).subscribe({
      next: (updated) => {
        this.bucket.set(updated);
        this.saving.set(false);
        this.renaming.set(false);
        this.toast.success(`Renamed to ${updated.name}.`);
      },
      error: () => this.saving.set(false),
    });
  }

  ngOnInit(): void {
    const given = this.initial();
    if (given) this.bucket.set(given);
    else this.api.mediaBucket(this.bucketId()).subscribe({ next: (b) => this.bucket.set(b) });

    this.api.mediaBucketPlans(this.bucketId()).subscribe({
      next: (plans) => this.plans.set(plans),
      error: () => this.plans.set([]),
    });
  }

  /** How full it is, in the units people think in — megabytes until there is a gigabyte in it. */
  protected used(bucket: MediaBucket): string {
    const gb = bucket.usedBytes / 1024 ** 3;
    return gb >= 1
      ? `${gb.toFixed(1)} GB of ${bucket.gb} GB`
      : `${Math.round(bucket.usedBytes / 1024 ** 2)} MB of ${bucket.gb} GB`;
  }

  protected choose(plan: MediaBucketPlan): void {
    if (this.resizing() || plan.isCurrent) return;
    this.resizing.set(true);
    this.api.chooseMediaBucketTier(this.bucketId(), plan.tier).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.resizing.set(false);
        this.sizing.set(false);
        this.toast.success(`This bucket now holds ${plan.gb} GB.`);
      },
      error: () => this.resizing.set(false),
    });
  }
}

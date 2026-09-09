import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { UiStatus } from '@zouriel/ui';
import { UiProgressBar } from '@zouriel/ui/progress';
import { ApiService } from '../api/api.service';
import { MediaBucket } from '../utils/types/api.types';

/**
 * How full a bucket is, and how much room is left in it. Nothing else.
 *
 * <p>It sits above the media grid, where somebody is looking at the photographs rather than
 * administering the thing holding them. "Is there room left" is the one bucket question you ask
 * while looking at pictures, so this answers it and stops — <b>a size is not chosen here</b>.
 * Choosing one is running the event, the same act as printing a code, and it lives on the
 * dashboard's card for this bucket with everything else that decides what the bucket IS. A picker
 * over the grid asked a host to buy storage while they were flicking through last night's
 * photographs, which is the wrong moment for that question and the wrong place for the answer.</p>
 */
@Component({
  selector: 'app-bucket-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, UiProgressBar],
  templateUrl: './bucket-size.component.html',
  styleUrl: './bucket-size.component.scss',
})
export class BucketSizeComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly bucketId = input.required<string>();

  /** Given by whoever already loaded it, so the page does not fetch the same bucket twice. */
  readonly initial = input<MediaBucket | null>(null);

  /** Only ever set when nobody handed us one — see {@link bucket}. */
  private readonly fetched = signal<MediaBucket | null>(null);

  /**
   * What is drawn. The given one WINS rather than being copied into state on init: renaming a
   * bucket or moving it onto a bigger size happens in the panel on the dashboard, and a bar holding
   * its own snapshot would go on quoting the old capacity until the page was reloaded.
   */
  protected readonly bucket = computed(() => this.initial() ?? this.fetched());

  ngOnInit(): void {
    if (!this.initial()) {
      this.api.mediaBucket(this.bucketId()).subscribe({ next: (b) => this.fetched.set(b) });
    }
  }

  /** How much of it is gone, in the units people think in. */
  protected used(bucket: MediaBucket): string {
    return `${this.amount(bucket.usedBytes)} of ${bucket.gb} GB used`;
  }

  /** How much is left — the half of the question a "x of y" line makes the reader do themselves. */
  protected free(bucket: MediaBucket): string {
    return this.amount(Math.max(0, bucket.capacityBytes - bucket.usedBytes));
  }

  /** Megabytes until there is a gigabyte worth saying. */
  private amount(bytes: number): string {
    const gb = bytes / 1024 ** 3;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
  }

  /** Colour is the warning: nobody reads a percentage until the bar has already told them. */
  protected tone(bucket: MediaBucket): UiStatus {
    if (bucket.percentUsed >= 95) return 'danger';
    return bucket.percentUsed >= 90 ? 'warning' : 'primary';
  }
}

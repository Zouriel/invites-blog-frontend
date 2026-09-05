import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { BucketPanelsComponent } from '../../shared/bucket-panels/bucket-panels.component';
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
  imports: [RouterLink, UiAlert, UiBadge, UiSpinner, UiText, BucketPanelsComponent, PhotoBoxComponent],
  templateUrl: './media-bucket.component.html',
  styleUrl: './media-bucket.component.scss',
})
export class MediaBucketComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly bucketId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly bucket = signal<MediaBucket | null>(null);

  // ngOnInit, not the constructor: an input has no value until after construction, so this would
  // otherwise load the bucket with an empty id.
  ngOnInit(): void {
    this.api.mediaBucket(this.bucketId()).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

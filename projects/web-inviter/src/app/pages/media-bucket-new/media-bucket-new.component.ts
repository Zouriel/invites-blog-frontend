import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { MediaBucketPlan } from '../../shared/utils/types/api.types';

/**
 * Buying a media bucket: what to call it, and how big.
 *
 * <p>The size is asked for HERE rather than after the fact, because it is the thing being bought.
 * A bucket created without one still works — it lands on the free tier — but the point of this page
 * is that somebody arrives at it wanting a place to keep a lot of photographs, and the sizes are the
 * answer to that.</p>
 *
 * <p><b>Payment is not wired up yet.</b> Choosing a size grants it. That is deliberate for now: the
 * product can be built and used before there is a checkout behind it, and when there is one it slots
 * in front of this call rather than replacing it.</p>
 */
@Component({
  selector: 'app-media-bucket-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink, UiButton, UiCard, UiDatePicker, UiFormField, UiInput, UiSpinner, UiText,
  ],
  templateUrl: './media-bucket-new.component.html',
  styleUrl: './media-bucket-new.component.scss',
})
export class MediaBucketNewComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  protected readonly title = signal('');

  /**
   * The night it is for, as `YYYY-MM-DD`. Required, because a bucket is an occasion rather than a
   * drive: this is what decides when it opens and when it stops taking anything.
   */
  protected readonly eventDate = signal('');
  protected readonly plans = signal<MediaBucketPlan[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);

  /** Null means the free tier — a real choice, and the one somebody just trying this out wants. */
  protected readonly chosen = signal<MediaBucketPlan | null>(null);

  constructor() {
    this.api.mediaBucketPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected choose(plan: MediaBucketPlan): void {
    this.chosen.set(this.chosen()?.tier === plan.tier ? null : plan);
  }

  protected create(): void {
    const title = this.title().trim();
    const date = this.eventDate();
    if (!title || !date || this.creating()) return;

    this.creating.set(true);
    this.api
      .createMediaBucket({
        title,
        tier: this.chosen()?.tier ?? null,
        // Midday rather than midnight: the window opens at the start of this day in Malé either way,
        // and a bare date parsed as UTC midnight can land on the previous day for a +05:00 reader.
        eventDate: `${date}T12:00:00`,
      })
      .subscribe({
      next: (bucket) => {
        this.creating.set(false);
        this.toast.success('Media bucket created.');
        void this.router.navigate(['/buckets', bucket.id]);
      },
      error: () => this.creating.set(false),
    });
  }
}

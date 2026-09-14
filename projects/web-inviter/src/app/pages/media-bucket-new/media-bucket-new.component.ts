import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';

/**
 * Starting a media bucket on its own: what it is for, the night, and how long it collects.
 *
 * <p>How much it holds comes from the account's plan, not from a size picked here.</p>
 */
@Component({
  selector: 'app-media-bucket-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink, UiButton, UiCard, UiDatePicker, UiFormField, UiInput, UiText,
  ],
  templateUrl: './media-bucket-new.component.html',
  styleUrl: './media-bucket-new.component.scss',
})
export class MediaBucketNewComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  /** Longer windows come with Premium. The server enforces it; this only decides what to say. */
  protected readonly isPremium = inject(SessionStore).isPremium;

  /** One night, or the longer windows a subscription unlocks. Capped where EventDayWindow caps it. */
  protected readonly windowChoices = [1, 3, 5] as const;
  protected readonly windowDays = signal(1);

  /**
   * Says why rather than doing nothing.
   *
   * <p>The locked choices are deliberately still clickable. A disabled control tells somebody they
   * cannot do a thing but never what the thing is or how to get it, and a control that is simply
   * absent reads as a bug — neither of those sells a subscription.</p>
   */
  protected chooseWindow(days: number): void {
    if (days > 1 && !this.isPremium()) {
      this.toast.info('Collecting for more than one day comes with Premium or an event pass.');
      return;
    }
    this.windowDays.set(days);
  }

  protected readonly title = signal('');

  /**
   * The night it is for, as `YYYY-MM-DD`. Required, because a bucket is an occasion rather than a
   * drive: this is what decides when it opens and when it stops taking anything.
   */
  protected readonly eventDate = signal('');
  protected readonly creating = signal(false);

  protected create(): void {
    const title = this.title().trim();
    const date = this.eventDate();
    if (!title || !date || this.creating()) return;

    this.creating.set(true);
    this.api
      .createMediaBucket({
        title,
        // Midday rather than midnight: the window opens at the start of this day in Malé either way,
        // and a bare date parsed as UTC midnight can land on the previous day for a +05:00 reader.
        eventDate: `${date}T12:00:00`,
        windowDays: this.windowDays(),
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

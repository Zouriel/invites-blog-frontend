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
import { BackLinkComponent } from '../../shared/back-link/back-link.component';
import { plan, spaceLadder } from '../../shared/utils/plans';

/**
 * Starting a media bucket on its own: what it is for, the night, and how long it collects.
 *
 * <p>How much it holds comes from the account's plan, not from a size picked here.</p>
 */
@Component({
  selector: 'app-media-bucket-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackLinkComponent,
    FormsModule, RouterLink, UiButton, UiCard, UiDatePicker, UiFormField, UiInput, UiText,
  ],
  templateUrl: './media-bucket-new.component.html',
  styleUrl: './media-bucket-new.component.scss',
})
export class MediaBucketNewComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  /**
   * One night, or the longer windows a pass unlocks: three days with a Party pass, five with a
   * Wedding pass. A new album has no pass yet, so those are shown and explained, not offered.
   */
  protected readonly windowChoices = [
    plan('Free').maxWindowDays ?? 1,
    plan('PartyPass').maxWindowDays!,
    plan('WeddingPass').maxWindowDays!,
  ];
  protected readonly passFor: Record<number, string> = {
    [plan('PartyPass').maxWindowDays!]: plan('PartyPass').name,
    [plan('WeddingPass').maxWindowDays!]: plan('WeddingPass').name,
  };
  protected readonly spaceLadder = spaceLadder();
  protected readonly windowDays = signal(1);

  /**
   * Says why rather than doing nothing.
   *
   * <p>The locked choices are deliberately still clickable. A disabled control tells somebody they
   * cannot do a thing but never what the thing is or how to get it, and a control that is simply
   * absent reads as a bug — neither of those sells a pass.</p>
   */
  protected chooseWindow(days: number): void {
    if (days > 1) {
      this.toast.info(`Collecting for ${days} days comes with a ${this.passFor[days]}. Add one to the event once it's made.`);
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
        this.toast.success('Album created.');
        void this.router.navigate(['/buckets', bucket.id]);
      },
      error: () => this.creating.set(false),
    });
  }
}

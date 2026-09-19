import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiAlert } from '@zouriel/ui/alert';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../../shared/icons/app-icons';

/** Post-finalize "share" page: shows the single shareable /e/{id} link + a Share/Copy button. */
@Component({
  selector: 'app-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, RouterLink, UiAlert, UiButton, UiCard, UiText, BrandMarkComponent],
  templateUrl: './success.component.html',
  styleUrl: './success.component.scss',
})
export class SuccessComponent {
  protected readonly appIcons = APP_ICONS;
  readonly campaignId = input.required<string>();

  protected readonly shareLink = signal('');
  protected readonly emailed = signal(0);
  /** Guests held back because the event's emailed invitations ran out. */
  protected readonly notEmailed = signal(0);
  protected readonly saveTheDate = signal(false);

  /** Whether the link handed back opens for anybody, or checks the guest list first. */
  protected readonly anonymous = signal(false);
  protected readonly copied = signal(false);

  constructor() {
    // The finalize result is passed via router state from the delivery step.
    const state = history.state as
      | { shareLink?: string; emailed?: number; notEmailed?: number; anonymous?: boolean; saveTheDate?: boolean }
      | null;
    this.shareLink.set(state?.shareLink ?? '');
    this.emailed.set(state?.emailed ?? 0);
    this.notEmailed.set(state?.notEmailed ?? 0);
    this.anonymous.set(state?.anonymous ?? false);
    this.saveTheDate.set(state?.saveTheDate ?? false);
  }

  protected share(): void {
    const url = this.shareLink();
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share(
          this.saveTheDate()
            ? { title: 'Save the date', text: 'Save the date! Add it to your calendar:', url }
            : { title: 'You’re invited', text: 'You’re invited! Open your invitation:', url },
        )
        .catch(() => {});
    } else {
      this.copy();
    }
  }

  protected copy(): void {
    const url = this.shareLink();
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      })
      .catch(() => {});
  }
}

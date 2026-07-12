import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';

/** Post-finalize "share" page: shows the single shareable /e/{id} link + a Share/Copy button. */
@Component({
  selector: 'app-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCard, UiText],
  templateUrl: './success.component.html',
  styleUrl: './success.component.scss',
})
export class SuccessComponent {
  readonly campaignId = input.required<string>();

  protected readonly shareLink = signal('');
  protected readonly emailed = signal(0);
  protected readonly copied = signal(false);

  constructor() {
    // The finalize result is passed via router state from the delivery step.
    const state = history.state as { shareLink?: string; emailed?: number } | null;
    this.shareLink.set(state?.shareLink ?? '');
    this.emailed.set(state?.emailed ?? 0);
  }

  protected share(): void {
    const url = this.shareLink();
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({ title: "You're invited", text: "You're invited! Open your invitation:", url })
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

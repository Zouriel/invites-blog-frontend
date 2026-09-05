import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';

/**
 * The campaign's cover photo — the picture it shows wherever it is listed rather than opened.
 *
 * <p><b>Why this exists.</b> The invitations grid used to fall back to the TEMPLATE's preview, which
 * is a marketing poster rendered from that template's own demo content. Every Gilded Hour invitation
 * therefore showed "AMELIA" — a stranger's name over somebody else's birthday. A poster identifies a
 * design; a tile has to identify the event, and only the host can say which picture does that.</p>
 *
 * <p>Used from both places a host would think to set it: the builder's Content step while making the
 * invitation, and the dashboard afterwards. Same component, because "change the cover" should not
 * mean two different things depending on which screen you happen to be on.</p>
 */
@Component({
  selector: 'app-cover-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiText],
  templateUrl: './cover-picker.component.html',
  styleUrl: './cover-picker.component.scss',
})
export class CoverPickerComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();

  /**
   * Whether the event this cover belongs to has an invitation. It may not — an event can be a media
   * bucket on its own — and the copy that talks about guests' lists and a template's preview picture
   * describes nothing that exists in that case.
   */
  readonly hasInvitation = input(true);

  /** The current cover URL, or null. Two-way so the host page can react without re-fetching. */
  readonly cover = model<string | null>(null);

  /** What the template would show if no cover is set — displayed as the "otherwise this" preview. */
  readonly fallback = input<string | null>(null);

  protected readonly busy = signal(false);

  /**
   * A template preview whose URL points at the template's own index.html is a page, not an image —
   * an old convention that would render as a broken picture here.
   */
  protected fallbackImage(): string | null {
    const url = this.fallback();
    return !url || url.endsWith('index.html') ? null : url;
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = (input.files ?? [])[0];
    // Cleared so picking the same file twice in a row still fires a change event.
    input.value = '';
    if (!file) return;

    this.busy.set(true);
    this.api.uploadCover(this.campaignId(), file).subscribe({
      next: (url) => {
        this.cover.set(url);
        this.busy.set(false);
        this.toast.success('Cover photo updated.');
      },
      error: () => this.busy.set(false),
    });
  }

  protected clear(): void {
    this.busy.set(true);
    this.api.setCover(this.campaignId(), null).subscribe({
      next: () => {
        this.cover.set(null);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }
}

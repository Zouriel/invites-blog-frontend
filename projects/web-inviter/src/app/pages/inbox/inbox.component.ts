import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiPosterGrid, UiPosterView } from '@zouriel/ui/media';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { eventPoster } from '../../shared/event-poster/event-poster';
import { MyInvite } from '../../shared/utils/types/api.types';

/**
 * The invitations that arrived, as a grid of pictures and nothing else. Tapping one opens it
 * full-size with its details (who sent it, when, the reply) on a fading layer at the bottom, and the
 * button into the invitation. The feed is its own tab in the bar, and the events a person is hosting
 * are on Me.
 *
 * <p>Received invitations are matched on EVERY identifier the account holds, so someone who booked an
 * invitation with their phone and designs under their email finds both here.</p>
 */
@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, UiBadge, UiButton, UiEmptyState, UiPosterGrid, UiPosterView, UiSpinner, UiText],
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss', '../../shared/event-poster/event-poster.scss'],
})
export class InboxComponent {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  private readonly all = signal<MyInvite[]>([]);

  /** Only what is still happening. A cancelled event isn't listed. */
  protected readonly received = computed(() => this.all().filter((i) => !i.cancelled));

  /**
   * Pictures only. The one thing a tile may say is that an invitation hasn't been opened yet (a dot),
   * because that is what the old "New" flag was for: finding the one you haven't seen.
   */
  protected readonly posters = computed(() =>
    this.received().map((i) => eventPoster(i.eventTitle, i.previewImageUrl, i.colours, i.isNew ? { tone: 'primary', label: 'New' } : null)),
  );

  protected readonly open = signal(false);
  private readonly index = signal(0);
  protected readonly current = computed(() => this.received()[this.index()] ?? null);
  protected readonly currentPoster = computed(() => this.posters()[this.index()] ?? null);

  constructor() {
    this.api.myInvites().subscribe({
      next: (list) => {
        this.all.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected show(i: number): void {
    this.index.set(i);
    this.open.set(true);
  }

  /** Green once they're going, red once they're not, neutral while they haven't said. */
  protected rsvpTone(status: string): 'success' | 'danger' | 'neutral' {
    if (status === 'Going') return 'success';
    if (status === 'NotGoing') return 'danger';
    return 'neutral';
  }

  /** The stored enum name is not something to show a person. */
  protected rsvpLabel(status: string): string {
    switch (status) {
      case 'Going':
        return 'Going';
      case 'NotGoing':
        return 'Not going';
      case 'Maybe':
        return 'Maybe';
      case 'ViewedOnly':
        return 'Opened';
      default:
        return 'No reply yet';
    }
  }
}

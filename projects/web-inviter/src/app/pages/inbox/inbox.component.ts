import { EventDayPipe } from '../../shared/pipes/event-time.pipe';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiPosterDetails, UiPosterGrid } from '@zouriel/ui/media';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { eventPoster } from '../../shared/event-poster/event-poster';
import { MyInvite } from '../../shared/utils/types/api.types';

/**
 * The invitations that arrived, as one grid of pictures with each one's details (name, who sent it,
 * when, the reply) on a fading layer over the bottom of its picture. Tapping one opens the
 * invitation, as the rows always did. The feed is its own tab in the bar, and the events a person is
 * hosting are on Me.
 *
 * <p>Received invitations are matched on EVERY identifier the account holds, so someone who booked an
 * invitation with their phone and designs under their email finds both here.</p>
 */
@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EventDayPipe, RouterLink, UiBadge, UiButton, UiEmptyState, UiPosterDetails, UiPosterGrid, UiSpinner, UiText],
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss', '../../shared/event-poster/event-poster.scss'],
})
export class InboxComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  private readonly all = signal<MyInvite[]>([]);

  /** Only what is still happening. A cancelled event isn't listed. */
  protected readonly received = computed(() => this.all().filter((i) => !i.cancelled));

  /** A dot still flags an invitation that hasn't been opened, as the old "New" flag did. */
  protected readonly posters = computed(() =>
    this.received().map((i) => eventPoster(i.eventTitle, i.previewImageUrl, i.colours, `/invitation/${i.campaignId}`, i.isNew ? { tone: 'primary', label: 'New' } : null)),
  );

  constructor() {
    this.api.myInvites().subscribe({
      next: (list) => {
        this.all.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Same place the rows went; a Ctrl/Cmd click still opens a new tab (the tile is a link). */
  protected open(i: number): void {
    const href = this.posters()[i]?.href;
    if (href) void this.router.navigateByUrl(href);
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

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { EventTileComponent } from '../../shared/event-tile/event-tile.component';
import { MyInvite } from '../../shared/utils/types/api.types';

/**
 * The invitations that arrived. The feed is its own tab in the bar, and the events a person is
 * hosting are on Me.
 *
 * <p>Received invitations are matched on EVERY identifier the account holds, so someone who booked an
 * invitation with their phone and designs under their email finds both here.</p>
 */
@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, EventTileComponent, RouterLink, UiBadge, UiButton, UiEmptyState, UiSpinner, UiText],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
})
export class InboxComponent {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  private readonly all = signal<MyInvite[]>([]);

  /** Only what is still happening. A cancelled event isn't listed. */
  protected readonly received = computed(() => this.all().filter((i) => !i.cancelled));

  constructor() {
    this.api.myInvites().subscribe({
      next: (list) => {
        this.all.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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

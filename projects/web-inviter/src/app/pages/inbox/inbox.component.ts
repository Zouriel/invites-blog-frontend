import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiText } from 'ui/text';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../shared/api/api.service';
import { MyCampaign, MyInvite } from '../../shared/utils/types/api.types';

/**
 * Everything that arrived, and everything that went out — the page a signed-in person lands on.
 *
 * Received invitations are matched on EVERY identifier the account holds, so someone who booked an
 * invitation with their phone and designs under their email finds both here.
 */
@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, RouterLink, UiBadge, UiButton, UiCard, UiEmptyState, UiSpinner, UiTab, UiTabs, UiText,
  ],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
})
export class InboxComponent {
  private readonly api = inject(ApiService);

  protected readonly loading = signal(true);
  protected readonly received = signal<MyInvite[]>([]);
  protected readonly sent = signal<MyCampaign[]>([]);

  /** Where an invitation can actually be opened and replied to. */
  protected readonly inviteeInbox = `${environment.inviteeBase}/inbox`;

  constructor() {
    let pending = 2;
    const done = () => {
      if (--pending <= 0) this.loading.set(false);
    };
    this.api.myInvites().subscribe({
      next: (list) => {
        this.received.set(list);
        done();
      },
      error: done,
    });
    this.api.myCampaigns().subscribe({
      next: (list) => {
        this.sent.set(list);
        done();
      },
      error: done,
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

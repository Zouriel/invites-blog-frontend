import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiText } from 'ui/text';
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Which tab is open lives in the URL rather than in the component, so a refresh — or a link
   * someone sends themselves — comes back to the tab they were on instead of resetting to Inbox.
   */
  protected readonly tab = signal(this.route.snapshot.queryParamMap.get('tab') === 'sent' ? 1 : 0);

  protected readonly loading = signal(true);
  protected readonly received = signal<MyInvite[]>([]);
  protected readonly sent = signal<MyCampaign[]>([]);

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

  /** Records the tab without adding a history entry — Back should leave the inbox, not switch tabs. */
  protected onTabChange(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: index === 1 ? 'sent' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
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

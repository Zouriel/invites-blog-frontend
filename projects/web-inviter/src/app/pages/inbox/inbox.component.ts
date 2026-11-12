import { EventDayPipe } from '../../shared/pipes/event-time.pipe';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { Router } from '@angular/router';
import { UiAvatarTag } from '@zouriel/ui/avatar-tag';
import { UiBadge } from '@zouriel/ui/badge';

import { UiEmptyState, UiStarterCard } from '@zouriel/ui/feedback';
import { UiHintOnce } from '@zouriel/ui/guidance';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { EmptyArtComponent } from '../../shared/guidance/empty-art.component';
import { RoleOffersComponent } from '../../shared/guidance/role-offers.component';
import { GuidanceService } from '../../shared/guidance/guidance.service';
import { TIP_TEXT } from '../../shared/guidance/tips';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { UiPosterCorner, UiPosterDetails, UiPosterGrid } from '@zouriel/ui/media';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { eventPoster } from '../../shared/event-poster/event-poster';
import { MyCampaign, MyInvite } from '../../shared/utils/types/api.types';

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
  imports: [EmptyArtComponent, EventDayPipe, HugeiconsIconComponent, RoleOffersComponent, UiAvatarTag, UiBadge, UiEmptyState, UiHintOnce, UiPosterCorner, UiPosterDetails, UiPosterGrid, UiSpinner, UiStarterCard, UiText],
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss', '../../shared/event-poster/event-poster.scss'],
})
export class InboxComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly guidance = inject(GuidanceService);
  protected readonly icons = APP_ICONS;
  protected readonly newTip = TIP_TEXT.inboxNew;

  protected readonly loading = signal(true);
  private readonly all = signal<MyInvite[]>([]);
  /** Events somebody organised for this account: "Your events", above the invitations. */
  protected readonly yours = signal<MyCampaign[]>([]);
  protected readonly yourPosters = computed(() =>
    this.yours().map((c) => eventPoster(c.title, c.previewImageUrl, c.colours, `/dashboard/${c.id}`)),
  );
  /** The first invitation not opened yet: where the "New" tip points. */
  protected readonly firstNew = computed(() => this.received().findIndex((i) => i.isNew));

  /** Only what is still happening. A cancelled event isn't listed. */
  protected readonly received = computed(() => this.all().filter((i) => !i.cancelled));

  /** A dot still flags an invitation that hasn't been opened, as the old "New" flag did. */
  protected readonly posters = computed(() =>
    this.received().map((i) => eventPoster(i.eventTitle, i.previewImageUrl, i.colours, `/invitation/${i.campaignId}`, i.isNew ? { tone: 'primary', label: 'New' } : null)),
  );

  constructor() {
    // Both lists before anything shows, so the page never says "empty" while one is on its way.
    forkJoin({
      invites: this.api.myInvites().pipe(catchError(() => of<MyInvite[]>([]))),
      mine: this.api.myCampaigns().pipe(catchError(() => of<MyCampaign[]>([]))),
    }).subscribe(({ invites, mine }) => {
      this.all.set(invites);
      this.yours.set(mine.filter((c) => c.relation === 'celebrant' && c.status !== 'Cancelled'));
      this.loading.set(false);
    });
  }

  protected go(path: string, queryParams?: Record<string, string>): void {
    void this.router.navigate([path], { queryParams });
  }

  protected openYours(i: number): void {
    const href = this.yourPosters()[i]?.href;
    if (href) void this.router.navigateByUrl(href);
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

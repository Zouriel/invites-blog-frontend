import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { MyCampaign, MyInvite } from '../../shared/utils/types/api.types';

/**
 * Everything that went out, and everything that arrived — the page a signed-in person lands on.
 *
 * <p><b>A grid, not a list.</b> An invitation is a designed object; a row of titles throws away the
 * only thing that distinguishes one from another. So both tabs show what each invitation LOOKS like,
 * and the tile is the whole target — tapping one opens that event.</p>
 *
 * <p>Received invitations are matched on EVERY identifier the account holds, so someone who booked an
 * invitation with their phone and designs under their email finds both here.</p>
 */
@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, RouterLink, UiBadge, UiButton, UiEmptyState, UiSpinner, UiTab, UiTabs, UiText,
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
   * someone sends themselves — comes back to the tab they were on instead of resetting.
   *
   * <p>"My invites" is first and is the default: the thing a person came here to do is usually
   * something with an invitation they are running.</p>
   */
  protected readonly tab = signal<'mine' | 'received'>(
    this.route.snapshot.queryParamMap.get('tab') === 'received' ? 'received' : 'mine',
  );

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
  protected select(tab: 'mine' | 'received'): void {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'received' ? 'received' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Posters that failed to load. A stored URL can outlive the object behind it — an asset swept by
   * retention, a storage backend mid-swap — and a grid of broken-image icons is a worse answer than
   * a grid of initials, so a failure demotes that tile to the fallback for the rest of the session.
   */
  private readonly broken = signal(new Set<string>());

  /**
   * The tile image. `previewImageUrl` historically pointed at a template's own index.html — a page,
   * not an image — so anything still pointing there counts as "no poster" rather than being rendered
   * into an `<img>` that would silently break.
   */
  protected poster(url: string | null): string | null {
    if (!url || url.endsWith('index.html')) return null;
    return this.broken().has(url) ? null : url;
  }

  protected onPosterError(url: string): void {
    this.broken.update((set) => new Set(set).add(url));
  }

  /** The initial shown on a tile with no poster, so a posterless grid still reads as distinct things. */
  protected initial(title: string): string {
    return (title?.trim()[0] ?? '?').toUpperCase();
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

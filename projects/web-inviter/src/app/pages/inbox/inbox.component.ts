import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { INBOX_TABS, InboxTab } from '../../shared/services/tab-rail';
import { MyCampaign, MyInvite } from '../../shared/utils/types/api.types';

/**
 * Tab order, and the values the URL carries. 'received' is the default and stays out of the query.
 *
 * <p>Received leads because of who is standing here. Everybody with an account has been invited to
 * something; only some of them are running an event, and the ones who are arrived by a link to that
 * event rather than by browsing to this page. Landing on an empty "Hosting" was the common
 * case telling the common visitor they had nothing.</p>
 *
 * <p>The order itself lives in the tab rail, which walks these three and then the next screen's —
 * see {@link TabRail}. One list, so a rename cannot leave the swipe pointing at a tab that is gone.</p>
 */
const TABS = INBOX_TABS;
type Tab = InboxTab;

/**
 * Everything that arrived, and everything that went out — the page a signed-in person lands on.
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
   * <p>Derived from the live params, not read once at construction: a swipe moves between these tabs
   * without rebuilding the page, and a snapshot would leave the strip on whichever tab happened to
   * be open when the reader first arrived.</p>
   */
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly tab = computed<Tab>(() => {
    const named = this.params().get('tab') as Tab | null;
    return named && TABS.includes(named) ? named : TABS[0];
  });

  /**
   * The index the tab strip is on. Derived from TABS rather than written out as a ladder of
   * ternaries, so reordering or adding a tab is a one-line change in one place instead of two
   * mappings in the template that have to agree with each other.
   */
  protected readonly tabIndex = computed(() => Math.max(0, TABS.indexOf(this.tab())));

  protected readonly tabs = TABS;

  protected readonly loading = signal(true);
  private readonly allReceived = signal<MyInvite[]>([]);
  private readonly allSent = signal<MyCampaign[]>([]);

  /**
   * Cancelled invitations are split out rather than dropped. They are still part of the record —
   * someone looking for an event that was called off should find it said so, not find nothing — but
   * they are not what either list is FOR, and mixed in they made every count read wrong.
   */
  protected readonly received = computed(() => this.allReceived().filter((i) => !i.cancelled));
  protected readonly sent = computed(() => this.allSent().filter((c) => c.status !== 'Cancelled'));
  protected readonly cancelledReceived = computed(() => this.allReceived().filter((i) => i.cancelled));
  protected readonly cancelledSent = computed(() =>
    this.allSent().filter((c) => c.status === 'Cancelled'),
  );
  protected readonly cancelledCount = computed(
    () => this.cancelledReceived().length + this.cancelledSent().length,
  );

  constructor() {
    let pending = 2;
    const done = () => {
      if (--pending <= 0) this.loading.set(false);
    };
    this.api.myInvites().subscribe({
      next: (list) => {
        this.allReceived.set(list);
        done();
      },
      error: done,
    });
    this.api.myCampaigns().subscribe({
      next: (list) => {
        this.allSent.set(list);
        done();
      },
      error: done,
    });
  }

  /** Records the tab without adding a history entry — Back should leave the inbox, not switch tabs. */
  protected select(tab: Tab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === TABS[0] ? null : tab },
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

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiFormField, UiInput, UiSearchInput, UiTimePicker } from '@zouriel/ui/form';
import { UiAlert } from '@zouriel/ui/alert';
import { UiModal } from '@zouriel/ui/dialog';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { SessionStore } from '../../shared/services/session.store';
import { ApiService } from '../../shared/api/api.service';
import { CelebrantsComponent } from '../../shared/celebrants/celebrants.component';
import { CampaignKind, MyCampaign, Template } from '../../shared/utils/types/api.types';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';

type Stage = 'details' | 'who' | 'kind' | 'pick';

/** The gallery category whose designs start a save the date (the server's SaveTheDates.Category). */
const SAVE_THE_DATE_CATEGORY = 'Save the Date';

/**
 * Starting an event, in four stages on one page.
 *
 * <p><b>details</b> makes the event (name and date) and gives it its free media bucket, since every
 * event has one. <b>who</b> adds the people it is for, like the couple (skippable; they can only
 * look, and full access is given later from the dashboard). <b>kind</b> asks whether it has an invitation, and which kind: dynamic (one of our
 * templates, personal per guest) or static (the customer's own upload). It can be skipped. <b>pick</b>
 * is the template picker for the dynamic kind, with templates reserved for this account on top.</p>
 *
 * <p>After the invitation wizard, or straight away when the invitation is skipped, the host lands on
 * the photos step to choose a bucket size.</p>
 *
 * <p>The route is signed-in only: a bucket belongs to an account, and every event now has one.</p>
 *
 * <p><b>A save the date</b> goes through the same flow. What makes it one is its design: one from the
 * Save the Date category (the server sets the kind when it is attached, and drops the empty album).
 * Its wizard then skips roles, RSVP and photos. The time is optional for every event; without one,
 * a save the date is an all-day entry in guests' calendars.</p>
 */
@Component({
  selector: 'app-new-event',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, BackLinkComponent,
    CelebrantsComponent, FormsModule, NgTemplateOutlet, RouterLink, UiAlert, UiButton, UiCard, UiDatePicker, UiFormField, UiInput,
    UiModal, UiSearchInput, UiSpinner, UiText, UiTimePicker, SafeUrlPipe,
  ],
  templateUrl: './new-event.component.html',
  styleUrl: './new-event.component.scss',
})
export class NewEventComponent {
  protected readonly appIcons = APP_ICONS;
  private readonly api = inject(ApiService);
  /** Designing one's own invitation is for designer accounts (and admins). */
  protected readonly isDesigner = inject(SessionStore).isDesigner;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Set from the URL when somebody comes back to an event they already made. */
  protected readonly campaignId = signal<string | null>(this.route.snapshot.queryParamMap.get('event'));

  protected readonly stage = signal<Stage>(this.campaignId() ? 'kind' : 'details');

  /**
   * Known once a design is attached (a Save the Date one makes a save the date). Coming back to an
   * event that already is one, its wording follows.
   */
  protected readonly kind = signal<CampaignKind>('invitation');
  protected readonly saveTheDate = computed(() => this.kind() === 'saveTheDate');

  protected readonly title = signal(this.api.getMeta(this.campaignId() ?? '').title ?? '');
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly creating = signal(false);

  /** How many people the event is for so far; Continue waits for one, Skip doesn't. */
  protected readonly celebrantCount = signal(0);

  /** Today in Malé, as ISO. Earlier days can't be picked: the camera and photos would never open. */
  protected readonly today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

  protected readonly ready = computed(() => !!this.title().trim() && !!this.date() && this.date() >= this.today);

  /**
   * An event this person started and never put anything in. Offered back before making another, so
   * pressing + a few times doesn't leave a trail of empty events.
   */
  protected readonly unfinished = signal<MyCampaign | null>(null);

  /** The design being looked at before it's used. */
  protected readonly previewing = signal<Template | null>(null);

  // ----- Picker ----------------------------------------------------------------------------------

  protected readonly query = signal('');
  private readonly allTemplates = signal<Template[] | null>(null);
  private readonly reserved = signal<Template[]>([]);

  /** Templates this account published itself — private ones never reach the gallery call below. */
  private readonly authored = signal<Template[]>([]);
  protected readonly attachingId = signal<string | null>(null);
  protected readonly loadingTemplates = computed(() => this.allTemplates() === null);

  constructor() {
    // Back on an event already made: its kind decides the wording and where a design leads.
    const existing = this.campaignId();
    if (existing) {
      this.api.getCampaignSummaryQuiet(existing).subscribe({
        next: (s) => this.kind.set(s.kind ?? 'invitation'),
        error: () => {},
      });
    }
    if (!this.campaignId()) {
      this.api.myCampaigns().subscribe({
        next: (list) => {
          const weekAgo = Date.now() - 7 * 24 * 3600_000;
          this.unfinished.set(
            (list ?? []).find(
              (c) =>
                c.status === 'Draft' && c.mediaOnly && c.guestCount === 0 && c.photoCount === 0 &&
                Date.parse(c.createdAt) > weekAgo,
            ) ?? null,
          );
        },
        error: () => {},
      });
    }
    this.api.listTemplates().subscribe({
      next: (page) => this.allTemplates.set(page.items ?? []),
      error: () => this.allTemplates.set([]),
    });
    this.api.myDedicatedTemplates().subscribe({
      // A reserved template that already made an invitation can't start another one.
      next: (list) => this.reserved.set((list ?? []).filter((t) => !t.isShowcase)),
      error: () => this.reserved.set([]),
    });
    this.api.myOwnTemplates().subscribe({
      next: (list) => this.authored.set(list ?? []),
      // Signed out, or no account templates — the picker is just the gallery then.
      error: () => this.authored.set([]),
    });
  }

  private matches(t: Template): boolean {
    const q = this.query().trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.category, t.description, t.designerName].some((v) => (v ?? '').toLowerCase().includes(q));
  }

  /**
   * Everything that is already this account's: reserved for them, and published by them. Both go on
   * top, and a template that is somehow in each list is shown once.
   */
  private readonly ownTemplates = computed(() => {
    const byId = new Map<string, Template>();
    for (const t of [...this.reserved(), ...this.authored()]) byId.set(t.id, t);
    return [...byId.values()];
  });

  protected readonly mine = computed(() => this.ownTemplates().filter((t) => this.matches(t)));

  protected readonly gallery = computed(() => {
    const ownIds = new Set(this.ownTemplates().map((t) => t.id));
    // A one-of-a-kind template that's already been used is a showcase: it can't start another event.
    return (this.allTemplates() ?? []).filter((t) => !ownIds.has(t.id) && !t.isShowcase && this.matches(t));
  });

  /** Some older templates point their preview at index.html, which is a page and not an image. */
  protected poster(t: Template): string | null {
    if (this.brokenPosters().has(t.id)) return null;
    const url = t.previewImageUrl;
    return url && !url.endsWith('index.html') ? url : null;
  }

  /** Posters that failed to load fall back to the name's first letter instead of a broken image. */
  private readonly brokenPosters = signal<ReadonlySet<string>>(new Set());

  protected noPoster(t: Template): void {
    this.brokenPosters.update((s) => new Set(s).add(t.id));
  }

  // ----- Actions ---------------------------------------------------------------------------------

  protected create(): void {
    const title = this.title().trim();
    const date = this.date();
    if (!title || !date || this.creating()) return;

    this.creating.set(true);
    // Midday, not midnight: a bare date read as UTC midnight lands on the previous day in Malé.
    // Sent with Malé's offset: the day and time the host typed are local, and the server's windows
    // are worked out by Malé's calendar.
    // No time yet means the day itself: a save the date made from this is an all-day calendar entry,
    // and no page invents a "12:00 PM" the host never gave.
    const allDay = !this.time();
    this.api.createEvent(title, `${date}T${this.time() || '12:00'}:00+05:00`, 'invitation', allDay).subscribe({
      next: (created) => {
        this.api.storeToken(created.campaignId, created.accessToken);
        this.api.storeMeta(created.campaignId, { title });
        this.campaignId.set(created.campaignId);
        // Every event gets the free bucket up front, so skipping the size step later still leaves one.
        // A failure here is not fatal: the photos step makes it if it is missing. If the event turns
        // out to be a save the date, attaching its design removes this (still empty) album.
        this.api.createCampaignBucket(created.campaignId).subscribe({ error: () => {} });
        this.creating.set(false);
        this.stage.set('who');
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { event: created.campaignId },
          replaceUrl: true,
        });
      },
      error: () => this.creating.set(false),
    });
  }

  protected continueWith(c: MyCampaign): void {
    this.campaignId.set(c.id);
    this.title.set(c.title);
    this.api.storeMeta(c.id, { ...this.api.getMeta(c.id), title: c.title });
    this.unfinished.set(null);
    this.stage.set('who');
    void this.router.navigate([], { relativeTo: this.route, queryParams: { event: c.id }, replaceUrl: true });
  }

  protected useDesign(): void {
    const t = this.previewing();
    const id = this.campaignId();
    if (!t || !id || this.attachingId()) return;

    this.attachingId.set(t.id);
    this.api.attachTemplate(id, t.id).subscribe({
      next: () => {
        this.api.storeMeta(id, { ...this.api.getMeta(id), packageUrl: t.packageUrl, templateName: t.name });
        // Close the preview first. Leaving with the modal still open used to strand its backdrop
        // over the next step; the library now cleans up after a destroyed dialog, but a page should
        // not rely on that to put its own modal away.
        this.previewing.set(null);
        // A Save the Date design makes a save the date: no roles step, and Theme skips itself for a
        // design with nothing to theme.
        void this.router.navigate(['/create', id, t.category === SAVE_THE_DATE_CATEGORY ? 'theming' : 'roles']);
      },
      error: () => this.attachingId.set(null),
    });
  }

  protected bringOwn(): void {
    void this.router.navigate(['/bring-your-own'], { queryParams: { forEvent: this.campaignId() } });
  }

  /** No invitation: go straight to choosing how much room the photos get, then to the event. */
  protected skipInvitation(): void {
    void this.router.navigate(['/create', this.campaignId(), 'photos'], { queryParams: { then: 'dashboard' } });
  }
}

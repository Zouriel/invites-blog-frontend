import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiText } from '@zouriel/ui/text';
import { UiBadge } from '@zouriel/ui/badge';
import { UiCard, UiStatCard } from '@zouriel/ui/card';
import { UiModal, UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiEditableText } from '@zouriel/ui/form';
import { UiEmptyState, UiResult } from '@zouriel/ui/feedback';
import { UiCheckbox, UiFormField, UiInput, UiPhoneInput, UiSwitch } from '@zouriel/ui/form';
import { UiMultiSelect } from '@zouriel/ui/combobox';
import { ApiService } from '../../shared/api/api.service';
import { BucketSettingsComponent } from '../../shared/bucket-settings/bucket-settings.component';
import { CelebrantsComponent } from '../../shared/celebrants/celebrants.component';
import { DeleteDraftComponent } from '../../shared/delete-draft/delete-draft.component';
import { BucketSizeComponent } from '../../shared/bucket-size/bucket-size.component';
import { BillingEvent, BillingItem, MediaBucket } from '../../shared/utils/types/api.types';
import { DashboardGuest, DashboardReport, GuestPayload } from '../../shared/utils/types/api.types';
import { SelectOption } from '../../shared/utils/constants/app.constants';
import { PhotoBoxComponent } from '../../shared/photo-box/photo-box.component';
import { CoverPickerComponent } from '../../shared/cover-picker/cover-picker.component';
import { FeedCoversComponent } from '../../shared/feed-covers/feed-covers.component';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { ActionTileComponent } from '../../shared/action-tile/action-tile.component';
import { catalog, mvr, plan, planLabel } from '../../shared/utils/plans';
import { planStatus } from '../../shared/plan-status/plan-status';
import { PlanStatusComponent } from '../../shared/plan-status/plan-status.component';
import { CheckoutFlow } from '../../shared/checkout/checkout-flow.service';
import { GuestListComponent } from './guest-list.component';
import { RegionService } from '../../shared/services/region.service';
import { phoneCountryOf, phoneProblem } from '../../shared/utils/phone';
import { formatEventTime } from '../../shared/utils/event-time';
import { photoWindowClosedLine } from '../../shared/utils/photo-window';
import { InvitePreviewService } from '../../shared/services/invite-preview.service';
import { UiAlert } from '@zouriel/ui/alert';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiStarterCard } from '@zouriel/ui/feedback';
import { UiHintOnce, UiOfferCard, UiTourAnchor } from '@zouriel/ui/guidance';
import { EmptyArtComponent } from '../../shared/guidance/empty-art.component';
import { GuidanceService, roleOfferId } from '../../shared/guidance/guidance.service';
import { ItemAnchorsDirective } from '../../shared/guidance/item-anchors.directive';
import { afterPaint, offerGate, tourRunner } from '../../shared/guidance/guidance-helpers';
import { roleBody, roleHeading } from '../../shared/guidance/role-offers.component';
import { TIP, TIP_TEXT, TOURS, tabTip } from '../../shared/guidance/tips';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyArtComponent, ItemAnchorsDirective, UiAlert, UiAvatar, UiHintOnce, UiOfferCard, UiStarterCard, UiTourAnchor,
    HugeiconsIconComponent, FeedCoversComponent, ActionTileComponent, PlanStatusComponent,
    UiMultiSelect,
    FormsModule,
    ReactiveFormsModule,
    UiSwitch,
    RouterLink,
    BucketSettingsComponent,
    CelebrantsComponent,
    DeleteDraftComponent,
    BucketSizeComponent,
    UiCard,
    UiButton,
    UiText,
    UiBadge,
    UiStatCard,
    GuestListComponent,
    UiPhoneInput,
    UiModal,
    UiConfirmDialog,
    UiSpinner,
    UiEmptyState,
    UiResult,
    UiCheckbox,
    UiFormField,
    UiInput,
    UiSwitch,
    PhotoBoxComponent,
    CoverPickerComponent,
    UiTab,
    UiTabs,
    UiEditableText,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly appIcons = APP_ICONS;
  private readonly api = inject(ApiService);
  private readonly checkout = inject(CheckoutFlow);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(UiToastService);
  /** The country phone inputs start on: the account's, else the visitor's. */
  protected readonly region = inject(RegionService);

  readonly campaignId = input.required<string>();
  /**
   * The example event (/example-event): drawn read-only from the demo response. Nothing on the page
   * may change anything: a click on anything that would answers with "Start your own" instead, and
   * demoInterceptor refuses any write that slips past.
   */
  readonly demo = input(false);
  protected readonly demoAsk = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);

  // ---------- guidance (docs/GUIDANCE.md) ----------

  protected readonly guidance = inject(GuidanceService);
  protected readonly tipText = TIP_TEXT;
  protected readonly offer = offerGate();
  private readonly runTour = tourRunner();
  /** Which card the offer slot holds: the celebrant's welcome or the organiser's look around. */
  protected readonly offerKind = signal<'role' | 'host'>('host');
  /** One-off tips may show: the account's state is in and no offer or tour took this visit. */
  protected readonly tipsReady = signal(false);
  private guided = false;

  /** Anyone but the organiser: a celebrant (read-only) or one given full access (a manager). */
  protected readonly forThem = computed(() => this.viewer() !== 'organiser');

  protected readonly roleHeading = computed(() => {
    const known = this.guidance.roleFor(this.campaignId());
    return roleHeading({ addedBy: known?.addedBy ?? null, title: this.report()?.title || 'this event' });
  });
  protected readonly roleBody = computed(() => roleBody(this.viewer() === 'manager' ? 'full' : 'look'));

  /**
   * The tour anchors on the event's own tabs: the first album's tab, and for the people the event is
   * for, the Dashboard tab as where the guests (and, with full access, the celebrants) are, since
   * their tour stays on the album.
   */
  protected readonly outerAnchors = computed(() => {
    const albums = this.saveTheDate() ? [] : this.buckets().length ? this.buckets().map((_, i) => (i === 0 ? 'dash.album' : null)) : ['dash.album'];
    const dash = this.forThem() ? (this.viewer() === 'manager' ? ['dash.guests', 'dash.celebrants'] : ['dash.guests']) : null;
    return [...albums, dash];
  });

  /**
   * Which tab is open lives in the URL, so a reload — or a link the host sends themselves — comes
   * back to where they were. It is a bucket's id, 'dashboard', or 'media' for an event that has no
   * bucket to name a tab after. A bucket is the default: before the night this page is set-up, but
   * afterwards it is what everyone returns for, and that is most of an event's life.
   */
  protected readonly tab = signal<string>(this.route.snapshot.queryParamMap.get('tab') ?? '');

  /**
   * The campaign's own name, edited in place. Its own control rather than part of the add-guest form
   * because it is not a form — it saves when the host finishes editing, not on a submit button.
   */
  protected readonly titleControl = this.fb.control('');
  protected readonly renaming = signal(false);

  /** The campaign's cover, and what it would fall back to without one. */
  protected readonly coverUrl = signal<string | null>(null);
  protected readonly templatePreviewUrl = signal<string | null>(null);

  protected readonly token = signal<string | null>(null);
  protected readonly report = signal<DashboardReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly canManage = signal(false);
  protected readonly resending = signal(false);
  protected readonly selected = signal<DashboardGuest[]>([]);

  protected readonly showAdd = signal(false);
  protected readonly showCancel = signal(false);
  protected readonly adding = signal(false);

  /** The guest being corrected, and null when the dialog is closed. */
  protected readonly editing = signal<DashboardGuest | null>(null);
  protected readonly saving = signal(false);

  /**
   * A second form rather than the add form reused. They differ in what they mean: adding decides
   * whether to send an invitation, correcting one never does — a host fixing a typo has not asked
   * for anything to go out, and a stray sendNow on this dialog would send it.
   */
  protected readonly editForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control(''),
    phone: this.fb.control<string | null>(null),
    roles: this.fb.control<string[]>([]),
  });
  private readonly editValue = toSignal(this.editForm.valueChanges, {
    initialValue: this.editForm.getRawValue(),
  });
  protected readonly canSaveGuest = computed(() => {
    const v = this.editValue();
    return (
      !!v.name?.trim() &&
      // Somebody who added themselves never had to give a contact, so fixing their name mustn't
      // demand one now.
      (!!v.email?.trim() || !!v.phone?.trim() || !!this.editing()?.selfAdded) &&
      (!this.rolesRequired() || !!v.roles?.length) &&
      !phoneProblem(v.phone)
    );
  });
  /** What's wrong with the number in the edit dialog, in words; null when it's fine or empty. */
  protected readonly editPhoneProblem = computed(() => phoneProblem(this.editValue().phone));

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control(''),
    phone: this.fb.control<string | null>(null),
    roles: this.fb.control<string[]>([]),
    // Off by default: being added already puts the event in their inbox and feed. A message goes
    // out only when the host asks for one.
    sendNow: this.fb.control(false),
  });
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly canAddGuest = computed(() => {
    const v = this.formValue();
    return (
      !!v.name?.trim() &&
      (!!v.email?.trim() || !!v.phone?.trim()) &&
      (!this.rolesRequired() || !!v.roles?.length) &&
      !phoneProblem(v.phone)
    );
  });
  protected readonly addPhoneProblem = computed(() => phoneProblem(this.formValue().phone));
  /** The number's problem is said once they've left the field, not at every digit while typing. */
  protected readonly addPhoneLeft = signal(false);
  protected readonly editPhoneLeft = signal(false);

  /** When the event is, on its own clock, with the viewer's time beside it when theirs differs. */
  protected readonly whenText = computed(() => {
    const r = this.report();
    return r ? formatEventTime(r.eventStartAt, r.timeZone, { allDay: r.allDay }) : '';
  });

  /** This campaign's configured roles, for the Add-guest role picker — free text let hosts typo
   * their way past whatever a role-aware template actually expects. */
  protected readonly roleChoices = computed<SelectOption[]>(() =>
    (this.report()?.roles ?? []).map((n) => ({ label: n, value: n })),
  );
  /** Every guest of an invitation with roles needs at least one. An uploaded design has none. */
  protected readonly rolesRequired = computed(
    () => !!this.report()?.roles?.length && !this.report()?.isImported,
  );

  /** The self-added guest being asked about removing, and null when nobody is. */
  protected readonly removing = signal<DashboardGuest | null>(null);

  protected removeGuest(): void {
    const guest = this.removing();
    if (!guest) return;
    this.api.removeSelfAddedGuest(this.campaignId(), guest.id, this.token() ?? undefined).subscribe({
      next: () => {
        this.removing.set(null);
        this.toast.success(`${guest.name} was removed.`);
        this.load();
      },
      error: () => this.removing.set(null),
    });
  }

  protected readonly togglingList = signal(false);

  /** Opens or closes the guest list to whoever has the public link. Reversible, so it acts at once. */
  protected setOpenList(on: boolean): void {
    if (this.togglingList()) return;
    this.togglingList.set(true);
    this.api.setOpenGuestList(this.campaignId(), on).subscribe({
      next: () => {
        this.togglingList.set(false);
        this.toast.success(on ? 'People with the link can now reply with their name.' : 'The link no longer takes replies.');
        this.load();
      },
      error: () => {
        this.togglingList.set(false);
        this.load();
      },
    });
  }

  protected openEdit(guest: DashboardGuest): void {
    this.editing.set(guest);
    this.editForm.reset({
      name: guest.name ?? '',
      email: guest.email ?? '',
      phone: guest.phone ?? null,
      roles: guest.roles ?? [],
    });
  }

  protected saveGuest(): void {
    const guest = this.editing();
    if (!guest || !this.canSaveGuest() || this.saving()) return;

    this.saving.set(true);
    const v = this.editForm.getRawValue();
    // Every field, every time. The server merges on "not null", so anything omitted keeps its old
    // value — which would make clearing an email impossible. Sending '' is how a host empties one.
    const payload: GuestPayload = {
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone ?? '',
      roles: v.roles,
      ...(v.phone && phoneCountryOf(v.phone) ? { phoneCountry: phoneCountryOf(v.phone)! } : {}),
    };

    this.api.updateGuest(this.campaignId(), guest.id, payload, this.token() ?? undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        // Re-fetched rather than patched in place: the server normalises the phone number and may
        // have changed more than was sent, and the row should show what was actually stored.
        this.load();
        this.toast.success('Guest updated.');
      },
      // ApiService has already said what went wrong; leaving the dialog open keeps their edits.
      error: () => this.saving.set(false),
    });
  }

  /**
   * This event's media buckets, oldest first — the first of them being the one the invitation's
   * camera and this page post to.
   *
   * <p>A list rather than a single bucket because an event can hold several with a pass, and every
   * bucket control is a question about a PARTICULAR one: what it is called,
   * the code that adds to it, how big it is. Drawing one panel for "the event's bucket" could only
   * ever mean the default silently, which is how a host prints the ceremony's code and puts it on
   * the after-party's tables.</p>
   *
   * <p>Fetched here rather than linked blindly because an event that predates buckets has no row
   * until something asks for one — and asking is what creates it.</p>
   */
  protected readonly buckets = signal<MediaBucket[]>([]);

  protected readonly togglingLink = signal(false);

  /**
   * Whether the link being generated may be opened by anybody.
   *
   * <p>An OPTION the button reads, not an action of its own. Ticking it used to mint a link on the
   * spot, which made an irreversible thing — a public address, once shared, cannot be unshared —
   * happen on a single stray click. Now the box only states an intention and the button acts on
   * it.</p>
   *
   * <p>Seeded from whether an anonymous code already exists, so the box describes the link the
   * event actually has when the page opens.</p>
   */
  protected readonly allowAnonymous = signal(false);

  /** The link this page produced, held until the host leaves. */
  protected readonly generatedLink = signal<string | null>(null);

  /**
   * The link to show: whatever was just generated, else the anonymous one the event already had.
   *
   * <p>The gated link is deliberately NOT shown until it is asked for. It is derivable from the
   * campaign id and always resolvable, so drawing it unprompted would put an address on screen that
   * the host never chose to hand out.</p>
   */
  protected readonly shownLink = computed(
    () => this.generatedLink() ?? this.report()?.openLink ?? null,
  );

  protected generateLink(): void {
    if (this.togglingLink()) return;
    this.togglingLink.set(true);
    const anon = this.allowAnonymous();

    this.api.generateOpenLink(this.campaignId(), anon).subscribe({
      next: ({ url }) => {
        this.generatedLink.set(url);
        this.togglingLink.set(false);
        // Re-read so openLink and the checkbox agree with what the server just stored — asking for
        // a gated link clears any anonymous code, and the card must stop showing the old one.
        this.load();
      },
      error: () => this.togglingLink.set(false),
    });
  }

  /** Stops sharing entirely: the anonymous code is dropped and the link stops resolving. */
  protected stopSharing(): void {
    if (this.togglingLink()) return;
    this.togglingLink.set(true);
    this.api.disableOpenLink(this.campaignId()).subscribe({
      next: () => {
        this.generatedLink.set(null);
        this.allowAnonymous.set(false);
        this.togglingLink.set(false);
        this.load();
        this.toast.success('That link no longer works.');
      },
      error: () => this.togglingLink.set(false),
    });
  }

  /** Where "continue setting it up" goes: an imported design has no content step to return to. */
  protected readonly resumeLink = computed(() => [
    '/create',
    this.campaignId(),
    this.report()?.resumeStep ?? (this.report()?.isImported ? 'guests' : 'roles'),
  ]);

  /** An event with no invitation finishes at the plan step and opens here after. */
  protected readonly resumeParams = computed(() =>
    this.report()?.resumeStep === 'photos' && !this.hasInvitation() ? { then: 'dashboard' } : {},
  );

  /**
   * The event's state in plain words. "Dispatched" was the server's word, and it was shown even when
   * nobody had been emailed, so the badge reads from what actually happened to the guests.
   */
  protected readonly statusText = computed(() => {
    const r = this.report();
    if (!r) return '';
    if (r.status === 'Cancelled') return 'Cancelled';
    if (r.status === 'Draft') return 'Not finished';
    if (!r.hasInvitation) return 'Photos only';
    const notYet = ['', 'None', 'Created', 'Queued', 'NotSent', 'Failed'];
    return (r.guests ?? []).some((g) => !notYet.includes(g.status ?? '')) ? 'Sent' : 'Not sent yet';
  });

  protected readonly statusTone = computed(() => {
    const text = this.statusText();
    return text === 'Sent' ? 'success' : text === 'Cancelled' ? 'danger' : text === 'Photos only' ? 'neutral' : 'warning';
  });

  protected copyOpenLink(link: string): void {
    void navigator.clipboard
      ?.writeText(link)
      .then(() => this.toast.success('Link copied.'))
      .catch(() => this.toast.danger('Could not copy that link.'));
  }

  /** Takes a rename or a resize back from the card that made it, so every copy on the page agrees. */
  protected onBucketChanged(bucket: MediaBucket): void {
    this.buckets.update((all) => all.map((b) => (b.id === bucket.id ? bucket : b)));
  }

  /**
   * Re-reads one bucket after something was added to it or taken out.
   *
   * <p>Asked of the server rather than counted here: what changed is how many BYTES are in it, and
   * only the server knows what the derivatives it wrote alongside the original came to. Without
   * this the bar above the grid goes on saying "0 items" over a grid with photographs in it.</p>
   */
  protected refreshBucket(bucketId: string): void {
    this.api.mediaBucket(bucketId).subscribe({ next: (b) => this.onBucketChanged(b) });
  }

  /**
   * Whether this event has an invitation. An event may be a bucket and nothing else, and the
   * dashboard is the place that offers it one. Defaulted true so nothing flashes an offer at a
   * campaign whose report has not arrived yet.
   */
  protected readonly hasInvitation = computed(() => this.report()?.hasInvitation !== false);

  private readonly previews = inject(InvitePreviewService);

  /** "View invite": anyone who can open this dashboard and has an invitation to look at (not the example). */
  protected readonly canPreview = computed(() => this.hasInvitation() && !this.demo() && !!this.report());

  protected viewInvite(): void {
    this.previews.open(this.campaignId());
  }

  /**
   * The event's photo window has ended: no new codes or links (the server refuses them with 409
   * window_closed). Shown as one line where they were; lengthening the window brings them back.
   */
  protected readonly linksClosed = computed(() => !!this.report()?.photoWindowClosed);
  protected readonly linksClosedLine = computed(() =>
    photoWindowClosedLine(this.report()?.photoWindowClosesAt, this.report()?.timeZone),
  );

  /** The event's pass and offer, for the organiser: drives "your pass ends soon — extend it". */
  protected readonly passInfo = signal<BillingEvent | null>(null);

  /** A save the date: no album, no replies, and "Make the invitation" once it has gone out. */
  protected readonly saveTheDate = computed(() => this.report()?.kind === 'saveTheDate');
  protected readonly makingInvitation = signal(false);

  /**
   * Starts the invitation from this save the date — its guests (with who was already emailed), the
   * pass and extra emails come along — and goes on to choosing its design. Made already, it opens it.
   */
  protected makeInvitation(): void {
    if (this.makingInvitation()) return;
    this.makingInvitation.set(true);
    this.api.makeInvitation(this.campaignId()).subscribe({
      next: (made) => {
        this.makingInvitation.set(false);
        if (made.alreadyMade) {
          void this.router.navigate(['/dashboard', made.campaignId]);
          return;
        }
        this.toast.success(
          made.guestsCopied
            ? `Your invitation is started, with the same ${made.guestsCopied} guest${made.guestsCopied === 1 ? '' : 's'}.`
            : 'Your invitation is started.',
        );
        void this.router.navigate(['/events/new'], { queryParams: { event: made.campaignId } });
      },
      error: () => this.makingInvitation.set(false),
    });
  }

  /** True once we know whether this event has a bucket, so the panel is not offered mid-flight. */
  protected readonly bucketKnown = signal(false);
  /** The bucket list has answered, either way. The fallback Media tab waits for it. */
  protected readonly bucketsLoaded = signal(false);
  protected readonly addingBucket = signal(false);

  protected readonly addingAnother = signal(false);

  /** How many albums this event's plan allows (1 Free, 2 Gold, 5 Platinum). */
  protected readonly maxBuckets = computed(() => this.buckets()[0]?.maxBuckets ?? 1);

  /** The ceiling no plan lifts: the Platinum pass's. The server decides — see MediaBucket.MaxPerCampaign. */
  private readonly mostAnyPlan = plan('PlatinumPass').maxBuckets ?? 5;

  /**
   * Whether this event has all the albums any plan allows.
   *
   * <p>Not a pass gate and so not offered-and-refused like one: there is nothing to buy
   * here and a permanently dead button is worse than none. The card stays and says what the ceiling
   * is.</p>
   */
  protected readonly atBucketLimit = computed(() => this.buckets().length >= this.mostAnyPlan);

  /** At the plan's limit, below the ceiling: a bigger pass adds more. */
  protected readonly needsPassForMore = computed(() => !this.atBucketLimit() && this.buckets().length >= this.maxBuckets());

  /** Which pass lifts the limit from where this event is. */
  protected readonly passForMore = computed(() =>
    this.maxBuckets() < (plan('GoldPass').maxBuckets ?? 2) ? 'a Gold or Platinum pass' : 'a Platinum pass');

  // ---------- who is looking ----------

  /** The organiser, a celebrant with full access, or a read-only celebrant. */
  protected readonly viewer = computed(() => this.report()?.viewer ?? 'organiser');
  protected readonly isCelebrant = computed(() => this.viewer() === 'celebrant');

  /** The bucket whose tab is open, or null on the Dashboard tab. */
  protected readonly activeBucket = computed(() => this.buckets()[this.tabIndex()] ?? null);

  /** The bucket whose settings modal is open. */
  protected readonly settingsFor = signal<MediaBucket | null>(null);

  /** The cover photos picker for the event's post. */
  protected readonly coversOpen = signal(false);

  /** Guests or Celebrants, inside the Dashboard tab. */
  protected readonly section = signal(0);

  private bucketsRequested = false;

  /**
   * A second bucket on the same event — the ceremony and the after-party, each with its own night
   * and its own audience.
   *
   * <p>Offered to everybody and refused with a reason, rather than hidden from the people it is
   * for sale to. The first bucket stays the event's default: it is the one the invitation's camera
   * and this dashboard post to, and adding another does not move that.</p>
   */
  protected addAnotherBucket(): void {
    if (this.addingAnother() || this.atBucketLimit()) return;
    if (this.needsPassForMore()) {
      this.toast.info(`More albums on this event come with ${this.passForMore()}.`);
      return;
    }
    this.addingAnother.set(true);
    this.api
      .createMediaBucket({
        title: this.titleControl.value?.trim() || 'Album',
        campaignId: this.campaignId(),
      })
      .subscribe({
        next: (bucket) => {
          // Appended rather than re-fetched, and appended at all: without this the new bucket had
          // no card and no code until the page was reloaded, so "add another" looked like it had
          // done nothing but toast.
          this.buckets.update((all) => [...all, bucket]);
          this.addingAnother.set(false);
          this.toast.success('Added another album to this event.');
        },
        error: () => this.addingAnother.set(false),
      });
  }

  /** Gives this event a bucket. Reading the page deliberately does not — this is the host saying yes. */
  protected addBucket(): void {
    if (this.addingBucket()) return;
    this.addingBucket.set(true);
    this.api.createCampaignBucket(this.campaignId()).subscribe({
      next: (bucket) => {
        this.buckets.set([bucket]);
        this.addingBucket.set(false);
      },
      error: () => this.addingBucket.set(false),
    });
  }

  constructor() {
    // Guidance once the page, its albums and the account's tips state are all in.
    effect(() => {
      const ready = !!this.report() && this.bucketsLoaded() && this.guidance.loaded();
      if (!ready || this.guided || this.demo()) return;
      this.guided = true;
      untracked(() => void this.guide());
    });
  }

  private async guide(): Promise<void> {
    const r = this.report();
    if (!r || r.isDraft || this.token()) return;
    const g = this.guidance;
    const wantsTour = this.route.snapshot.queryParamMap.get('tour') === 'celebrant';
    if (this.forThem()) {
      const full = this.viewer() === 'manager';
      // "Show me around" on the Feed or Inbox card: straight into the tour.
      if (wantsTour) {
        g.ackRole(this.campaignId());
        return this.celebrantTour(full);
      }
      // The card shows here only if it wasn't answered on the Feed or Inbox. Opening the event
      // answers the role either way (the server notes it too).
      this.offerKind.set('role');
      const o = await this.offer.ask(roleOfferId(this.campaignId()), { event: true });
      g.ackRole(this.campaignId());
      if (o === 'finished') return this.celebrantTour(full);
      if (o === null) this.tipsReady.set(true);
      return;
    }
    // The organiser: a look around the first time, unless they already know the way (sent before).
    this.offerKind.set('host');
    const o = await this.offer.ask(TIP.offerHost, { event: true, skipWhen: g.progress().hasSent });
    if (o === 'finished') {
      this.selectTabAt(this.tabKeys().length - 1);
      this.section.set(0);
      await afterPaint();
      await this.runTour(TOURS.host);
      return;
    }
    if (o !== null) return;
    this.tipsReady.set(true);
  }

  private async celebrantTour(full: boolean): Promise<void> {
    this.selectTabAt(0);
    await afterPaint();
    await this.runTour(TOURS.celebrant(full));
  }

  /** The Dashboard tab's one-off tip: guests and celebrants are two tabs (tip.dash.people). */
  private readonly peopleTip = effect(() => {
    const onDash = this.tabKeys()[this.tabIndex()] === 'dashboard';
    if (!this.tipsReady() || !onDash || !this.canManage() || this.forThem()) return;
    untracked(async () => {
      await afterPaint();
      await this.runTour(tabTip(TIP.dashPeople, 'dash.people-tabs', TIP_TEXT.dashPeople), {
        kind: 'tip',
        skipWhen: this.guidance.progress().hasGuests,
      });
    });
  });

  protected startOwn(): void {
    this.demoAsk.set(false);
    void this.router.navigate(['/events/new']);
  }

  /** Clicks inside the example that would change something: stopped before they reach the control. */
  private guardDemo(): void {
    const root = this.host.nativeElement as HTMLElement;
    root.addEventListener(
      'click',
      (e: Event) => {
        if (!this.demo()) return;
        const t = e.target as HTMLElement | null;
        const control = t?.closest(
          'a[href], button, input, label, select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], ui-editable-text, ui-checkbox, ui-switch',
        );
        if (!control || !root.contains(control)) return;
        // Looking around stays possible: the tabs, the photos (they open the viewer) and the banner.
        if (control.closest('[role="tablist"], [data-demo-ok], .gallery, ui-modal, ui-confirm-dialog')) return;
        e.preventDefault();
        e.stopPropagation();
        this.demoAsk.set(true);
      },
      true,
    );
  }

  /** The guest-list upload lives in the event's guest step. */
  protected uploadList(): void {
    void this.router.navigate(['/create', this.campaignId(), 'guests']);
  }

  /** "Share one open link": the public-link section, on this same tab. */
  protected toOpenLink(): void {
    (this.host.nativeElement as HTMLElement).querySelector('.openlink')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ngOnInit(): void {
    this.guardDemo();
    this.watchRename();
    // The dashboard token is a magic-link secret (Campaign.DashboardTokenHash) — cryptographically
    // unrelated to the builder possession token TokenStore caches under the same campaign id
    // (Campaign.AccessTokenHash, see api.getToken()). Never fall back to or overwrite that cache
    // here: a browser that previously built or resumed this campaign would have a stale access
    // token sitting in that slot, and sending it as a dashboard token gets rejected by the API even
    // though the signed-in account genuinely owns the campaign — which is exactly what made "Sent"
    // items fail to open for some users while working for others (device/cache dependent).
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
    this.load();
    // Back from the bank's page (a pass bought or extended here): say what happened, then show it.
    this.checkout.confirmReturn(this.route).subscribe((status) => {
      if (status === 'Paid') {
        this.reloadPlan();
        this.load();
      }
    });
  }

  // ---------- emailed invitations ----------

  /** The price of more, for the note beside the send buttons. */
  protected readonly mvr = mvr;
  protected readonly sendingPrice = `${mvr(catalog().sending.perBlock)} per ${catalog().sending.blockSize}`;
  /**
   * The plan the note names when nothing is included: the event's own (Studio, Photographer and Premium events include
   * no emailed invitations either; only a pass does), not always "Free" (UI audit 2026-11-13).
   */
  protected readonly sendingPlanName = computed(() => {
    const kind = this.passInfo()?.plan;
    return kind ? planLabel(kind) : "this event's plan";
  });

  // ---------- the plan card ----------

  protected readonly buying = signal<BillingItem | null>(null);

  /** What the plan card says and offers: see planStatus (shared/plan-status). */
  protected readonly planCard = computed(() => {
    const e = this.passInfo();
    return e ? planStatus(e, this.buckets(), catalog().keepPhotos.price) : null;
  });

  /** An event without an invitation can have one; a save the date without one needs a design first. */
  protected readonly canAddInvitation = computed(() => !this.hasInvitation() && !this.report()?.isDraft);

  /** Another album, only while the event's plan allows one more. */
  protected readonly canAddAlbum = computed(() => {
    if (this.saveTheDate() || !this.bucketKnown()) return false;
    const count = this.buckets().length;
    return count === 0 || (!this.atBucketLimit() && count < this.maxBuckets());
  });

  protected addInvitation(): void {
    void this.router.navigate(['/events/new'], { queryParams: { event: this.campaignId() } });
  }

  private reloadPlan(): void {
    this.api.billingEvent(this.campaignId()).subscribe({ next: (e) => this.passInfo.set(e), error: () => {} });
  }

  /** One way to pay for anything on the plan card: the review step, then the bank; "Ask us" while payments are off. */
  protected planAction(item: BillingItem): void {
    if (this.buying()) return;
    this.buying.set(item);
    this.checkout.start({ item, campaignId: this.campaignId(), quantity: 1, returnPath: `/dashboard/${this.campaignId()}` }).subscribe({
      next: (r) => {
        this.buying.set(null);
        if (r.kind !== 'unavailable') return;
        if (r.message) this.toast.info(r.message);
        void this.router.navigate(['/inquire'], {
          queryParams: { topic: r.inquireTopic ?? (item.startsWith('platinum') ? 'platinum' : 'gold'), event: this.campaignId() },
        });
      },
      error: () => this.buying.set(null),
    });
  }








  /**
   * Two calls, in this order, because they answer different questions. The first is the only one
   * that refuses a caller who does not own the event, and it also adopts the rows of events whose
   * photographs predate buckets. The second returns ALL of them. A read-only celebrant can't ask the
   * first, and only needs the second.
   */
  private loadBuckets(): void {
    // A save the date has no album: nothing to load, and nothing to offer to add.
    if (this.saveTheDate()) {
      this.bucketKnown.set(false);
      this.bucketsLoaded.set(true);
      return;
    }
    const id = this.campaignId();
    const list$ = this.isCelebrant()
      ? this.api.visibleBuckets(id)
      : this.api.campaignBucket(id).pipe(
          switchMap((first) =>
            first
              ? this.api.visibleBuckets(id).pipe(
                  // The list can only ever be a superset of the bucket we already hold.
                  map((list) => (list.length ? list : [first])),
                  catchError(() => of([first])),
                )
              : of<MediaBucket[]>([]),
          ),
        );
    list$.subscribe({
      next: (list) => {
        this.buckets.set(list);
        this.bucketKnown.set(true);
        this.bucketsLoaded.set(true);
      },
      // A host on the emailed possession link holds no account, so this 403s. Nothing is offered.
      error: () => {
        this.bucketKnown.set(false);
        this.bucketsLoaded.set(true);
      },
    });
  }

  /**
   * Saves the new name. Bound to the control's value stream rather than a button because
   * ui-editable-text commits when the host leaves the field — there is no submit to hang this on.
   */
  private watchRename(): void {
    this.titleControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const title = (value ?? '').trim();
        // Empty is a half-finished edit, not an instruction to erase the name.
        if (!title || title === this.report()?.title) return;

        this.renaming.set(true);
        this.api.renameCampaign(this.campaignId(), title).subscribe({
          next: () => {
            // Keep the heading in step without re-fetching the whole dashboard.
            this.report.update((r) => (r ? { ...r, title } : r));
            this.renaming.set(false);
          },
          error: () => this.renaming.set(false),
        });
      });
  }

  /**
   * The tabs in the order they are drawn: one per bucket, then the dashboard. Kept as keys rather
   * than as indices because the buckets arrive after the page does — an index would mean something
   * different before and after they land, and the tab in the URL has to survive that.
   */
  private readonly tabKeys = computed<string[]>(() => {
    if (this.saveTheDate()) return ['dashboard'];
    const ids = this.buckets().map((b) => b.id);
    return [...(ids.length ? ids : ['media']), 'dashboard'];
  });

  /** Falls back to the first tab, which is also where an unrecognised ?tab= lands. */
  protected readonly tabIndex = computed(() => Math.max(0, this.tabKeys().indexOf(this.tab())));

  protected selectTabAt(index: number): void {
    const keys = this.tabKeys();
    const key = keys[index] ?? keys[0];
    this.tab.set(key);
    void this.router.navigate([], {
      relativeTo: this.route,
      // The first tab is where a bare link lands anyway, so it stays out of the URL. Query params
      // are MERGED, never replaced: the emailed dashboard link carries ?token= and dropping it
      // would lock a token-authed host out of their own campaign on the next reload.
      queryParams: { tab: index === 0 ? null : key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected rate(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  protected load(): void {
    // Two ways to be here: holding the emailed link's token, or signed in as the account that booked
    // it (opened from Sent). The second has no token and doesn't need one — the account is the proof.
    const token = this.token();
    this.loading.set(true);
    const request = token
      ? this.api.dashboard(this.campaignId(), token)
      : this.api.myDashboard(this.campaignId());
    request.subscribe({
      next: (r) => {
        this.report.set(r);
        // The box describes the link the event HAS when the page opens, so a host who already made
        // an anonymous one does not find it reading "not anonymous" over a link that is.
        this.allowAnonymous.set(!!r.openLink);
        this.coverUrl.set(r.coverImageUrl ?? null);
        // emitEvent: false — seeding the field is not the host renaming it, and without this every
        // load would post the name straight back to the server.
        this.titleControl.setValue(r.title ?? '', { emitEvent: false });
        this.templatePreviewUrl.set(r.templatePreviewImageUrl ?? null);
        // The server says who is looking. Only a read-only celebrant is kept from changing things.
        this.canManage.set(r.viewer !== 'celebrant');
        this.loading.set(false);
        // After the report, because which bucket routes to ask depends on who is looking.
        if (!this.bucketsRequested) {
          this.bucketsRequested = true;
          this.loadBuckets();
        }
        // The plan card: whether its pass is ending, and what another year costs. For whoever is
        // signed in and involved, the people it is for included (they may buy its pass since
        // 2026-11-12); not on the emailed host link, which carries no account to pay with.
        if (!token && !r.isDraft && !this.demo()) this.reloadPlan();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          token
            ? 'We could not load this dashboard. The link may have expired.'
            : "This campaign isn't on your account. Open it with the dashboard link emailed to you.",
        );
      },
    });
  }

  protected onSelectionChange(rows: DashboardGuest[]): void {
    this.selected.set(rows);
  }

  protected resendSelected(): void {
    const rows = this.selected();
    if (!this.canManage() || rows.length === 0 || this.resending()) {
      return;
    }
    this.resending.set(true);
    let pending = rows.length;
    let sent = 0;
    let failed = 0; // reached the server but the provider didn't accept it — not an HTTP error
    const finish = () => {
      if (--pending > 0) return;
      this.resending.set(false);
      this.load();
      if (failed > 0) {
        this.toast.danger(
          sent > 0
            ? `Sent to ${sent} of ${sent + failed} selected guest${sent + failed === 1 ? '' : 's'}. ${failed} didn't send. Check they have a valid email or phone number.`
            : `Could not send to ${failed} guest${failed === 1 ? '' : 's'}. Check they have a valid email or phone number.`,
        );
      } else if (sent > 0) {
        this.toast.success(`Sent to ${sent} guest${sent === 1 ? '' : 's'}.`);
      }
    };
    for (const g of rows) {
      this.api.resendGuest(this.campaignId(), g.id, this.token() ?? undefined).subscribe({
        next: (r) => {
          if (r.sent) sent++; else failed++;
          finish();
        },
        // A thrown HTTP error (rate limit, ownership, etc.) already toasts via ApiService —
        // nothing else to add here beyond letting the batch finish and the table refresh.
        error: finish,
      });
    }
  }

  protected addGuest(): void {
    if (!this.canAddGuest() || this.adding()) {
      return;
    }
    this.adding.set(true);
    const v = this.form.getRawValue();
    const payload: GuestPayload = {
      name: v.name.trim(),
      email: v.email.trim() || undefined,
      phone: v.phone || undefined,
      phoneCountry: (v.phone && phoneCountryOf(v.phone)) || undefined,
      roles: v.roles.length ? v.roles : undefined,
      sendNow: v.sendNow && this.hasInvitation() && !this.linksClosed(),
    };
    this.api.addGuest(this.campaignId(), payload, this.token() ?? undefined).subscribe({
      next: (r) => {
        this.adding.set(false);
        this.showAdd.set(false);
        this.form.reset({ name: '', email: '', phone: null, roles: [], sendNow: false });
        this.load();
        if (r.added === 0) {
          // A no-op — same email/phone as an existing guest, deduped server-side. Nothing was added
          // or sent, so neither "failed to send" nor "sent" is true here.
          this.toast.info('That guest is already on the list, so they weren\'t added again.');
        } else if (payload.sendNow && !r.sent) {
          this.toast.danger('Guest added, but the invitation didn\'t send. Fix it, then select them and send again.');
        } else if (payload.sendNow && r.sent) {
          this.toast.success('Guest added and sent their invite.');
        } else if (this.hasInvitation()) {
          this.toast.success('Guest added. Select them and “Send to selected” when you’re ready to send.');
        } else {
          this.toast.success('Guest added.');
        }
      },
      error: () => this.adding.set(false),
    });
  }

  protected cancelCampaign(): void {
    this.api.cancelCampaign(this.campaignId(), this.token() ?? undefined).subscribe({
      next: () => {
        // Say it happened and leave: a cancelled event is done with, and staying on its page left
        // people unsure whether the button had worked.
        const title = this.report()?.title || 'The event';
        this.toast.success(`${title} was cancelled.`);
        void this.router.navigate(['/me']);
      },
      error: () => {
        /* toast already shown by ApiService */
      },
    });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Download04Icon from '@hugeicons/core-free-icons/Download04Icon';
import HeartbreakIcon from '@hugeicons/core-free-icons/HeartbreakIcon';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import Share08Icon from '@hugeicons/core-free-icons/Share08Icon';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiTaskProgressDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFilter, UiFilterChips, uiFilterCount, uiFilterPrune, type UiFilterValue } from '@zouriel/ui/filter';
import { UiMediaAction, UiMediaItem, UiMediaLightbox } from '@zouriel/ui/file-viewer';
import { UiHeartBurst, UiLikeButton, UiLikeCount, UiMasonryGrid, UiMasonryTile, UiSelectable, UiSelectionBar, type UiSelectionAction } from '@zouriel/ui/media';
import { UiProgressBar } from '@zouriel/ui/progress';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { Observable, firstValueFrom } from 'rxjs';
import { SessionStore } from '../services/session.store';
import { ApiService } from '../api/api.service';
import { ModerationStore } from '../moderation/moderation.store';
import { UploadQueue } from '../upload-queue/upload-queue';
import { DirectUploadTicket, EventPhoto, EventPhotoBox } from '../utils/types/api.types';
import { albumFilterSections, applyAlbumFilter, DEFAULT_COLUMNS, describeAlbumFilter, tileHeightRatio } from './gallery';
import { canShareFiles, fetchOriginals, shareFiles, shareRefusal, stillActive } from './photo-share';
import { formatBytes } from '../utils/plans';

/**
 * An event's photo box (§5) — what everyone shot at the party, as a grid.
 *
 * <p>Used from both sides of the same event: the host sees it under their dashboard, a guest sees it
 * under the invitation they were sent. Which of those is the only thing that changes, and it changes
 * only <i>which endpoint</i> is called — the server decides who may look and what they may remove, so
 * the two modes here differ by a URL and nothing else. `canDelete` in particular arrives per photo
 * and is never re-derived in the browser.</p>
 *
 * <p>Square tiles, because the grid is the one screen guaranteed to render hundreds of images at
 * once on a phone. Each tile loads `thumbUrl`; the full photo is fetched only when someone opens
 * one.</p>
 *
 * <p>Opening one hands it to `ui-media-lightbox`, which takes the whole screen. That is the right
 * frame for what this holds: a night's photographs and clips are looked THROUGH, not looked at one
 * at a time in a panel with a page still visible around it. The grid keeps the list and the position
 * in it; the lightbox only moves that number.</p>
 */
@Component({
  selector: 'app-photo-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HugeiconsIconComponent,
    UiButton,
    UiConfirmDialog,
    UiEmptyState,
    UiFilter,
    UiFilterChips,
    UiMasonryGrid,
    UiMasonryTile,
    UiMediaLightbox,
    UiHeartBurst,
    UiLikeButton,
    UiLikeCount,
    UiSelectable,
    UiSelectionBar,
    UiTaskProgressDialog,
    UiProgressBar,
    UiSpinner,
    UiText,
  ],
  templateUrl: './photo-box.component.html',
  styleUrl: './photo-box.component.scss',
})
export class PhotoBoxComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly mod = inject(ModerationStore);
  private readonly session = inject(SessionStore);
  private readonly lightbox = viewChild(UiMediaLightbox);
  protected readonly heartIcon = FavouriteIcon;

  /** Hearts need an account: a guest who came in by a link sees the counts but cannot add to them. */
  protected readonly canLike = computed(() => this.session.isSignedIn());

  /** Hearted or not, and the count, with the server's answer replacing the guess (or undoing it). */
  protected setLiked(photo: EventPhoto, liked: boolean): void {
    if (!!photo.favourited === liked) return;
    const patch = (fields: Partial<EventPhoto>) =>
      this.box.update((box) =>
        box ? { ...box, photos: box.photos.map((p) => (p.id === photo.id ? { ...p, ...fields } : p)) } : box,
      );
    const before = { favourited: !!photo.favourited, favouriteCount: photo.favouriteCount ?? 0 };
    patch({ favourited: liked, favouriteCount: Math.max(0, before.favouriteCount + (liked ? 1 : -1)) });
    (liked ? this.api.favourite(photo.id) : this.api.unfavourite(photo.id)).subscribe({
      next: (state) => patch(state),
      error: () => {
        patch(before);
        this.toast.danger(liked ? 'That didn’t save to your favourites. Try again.' : 'That didn’t come off your favourites. Try again.');
      },
    });
  }

  /** A double tap on a tile: hearts it with a pop, or takes the heart back. */
  protected likeFromTile(photo: EventPhoto, at: { x: number; y: number }, burst: UiHeartBurst): void {
    if (!this.canLike()) return;
    if (!photo.favourited) burst.play(at.x, at.y);
    this.setLiked(photo, !photo.favourited);
  }

  /** The same in the viewer. */
  protected likeFromViewer(e: { index: number; x: number; y: number }): void {
    const photo = this.shown()[e.index];
    if (!photo || !this.canLike()) return;
    if (!photo.favourited) this.lightbox()?.playHeart(e.x, e.y);
    this.setLiked(photo, !photo.favourited);
  }

  protected readonly playIcon = PlayIcon;

  /**
   * What this box belongs to. A campaign id in 'host' and 'guest' mode; a BUCKET id in 'bucket'
   * mode, which is the only way a bucket with no event behind it can be opened at all.
   */
  readonly campaignId = input.required<string>();

  /**
   * Which door this instance came through. 'host' is the dashboard, authorised by owning the
   * campaign; 'guest' is an invitation, authorised by being on its guest list. The server enforces
   * both — this only picks the matching route.
   */
  readonly as = input.required<'host' | 'guest' | 'bucket' | 'favourites'>();

  /** Heading above the grid. Omitted where the surrounding page already says whose event this is. */
  readonly heading = input<string | null>(null);

  /**
   * Whether whoever is looking may take the whole box away as a zip.
   *
   * <p>Left unset it follows the mode, which is the safe reading: the archive is built by a
   * CAMPAIGN-scoped endpoint that only a host may call, and a bucket can also be opened by a member
   * the owner let in. A page that already knows it is standing behind ownership says so — the event
   * dashboard does — and gets the button back for a host looking at one bucket of their own night,
   * which is otherwise the one place this feature quietly disappeared when the tabs became
   * per-bucket.</p>
   */
  readonly archivable = input<boolean | null>(null);

  /**
   * That what is in the box changed. How full a bucket is is drawn OUTSIDE this component — the bar
   * above the grid — and it is read once when the page loads; without this, adding a photograph
   * leaves "0 items" sitting over a grid with something in it.
   */
  readonly contentsChanged = output<void>();

  protected readonly loading = signal(true);
  /** Each photo goes on its own through this; see {@link onPicked}. */
  protected readonly queue = new UploadQueue(
    {
      link: (file) => this.linkFor(file),
      legacy: (file) => this.send([file]),
      complete: (id) => this.api.completeDirectUpload(id),
      status: (ids) => this.api.directUploadStatus(ids),
    },
    {
      added: (photo) => {
        if (photo) this.addToBox([photo]);
        this.landed++;
      },
      refused: (message) => this.toast.danger(message),
    },
  );
  /** Running count of photos in, so the wrap-up can say how many this pick added. */
  private landed = 0;
  protected readonly uploading = computed(() => this.queue.sending());
  protected readonly box = signal<EventPhotoBox | null>(null);

  /** Whether the lightbox is up, and which of the photos it is showing. */
  protected readonly viewing = signal(false);
  protected readonly viewingAt = signal(0);

  /** The photo the lightbox is on, if it is up. */
  protected readonly opened = computed(() =>
    this.viewing() ? (this.shown()[this.viewingAt()] ?? null) : null,
  );

  /**
   * The box as the lightbox wants it: the same list, said its way.
   *
   * <p>The viewing copy rather than the original, deliberately — a phone opening a 12-megapixel
   * original for every swipe would spend the night downloading. The original is what the download
   * action hands over, and only when asked for.</p>
   */
  protected readonly items = computed<UiMediaItem[]>(() =>
    this.shown().map((photo) => ({
      src: photo.url,
      thumb: photo.thumbUrl,
      kind: this.isVideo(photo) ? 'video' : 'image',
      alt: this.tileAlt(photo),
      caption: [photo.albumTitle, photo.uploaderName ? `From ${photo.uploaderName}` : null].filter(Boolean).join(' · ') || undefined,
    })),
  );

  /**
   * What the lightbox offers over the open photo. `canDelete` comes from the server per photo and is
   * never re-derived here — `when` only decides whether to draw the button the server already
   * allowed.
   */
  protected readonly viewerActions: UiMediaAction[] = [
    {
      id: 'download',
      // "Download", not "Download original": the longer label left no room on a phone for Report.
      // The ORIGINAL, not the viewing copy the lightbox is showing. Not a link: the lightbox opens
      // links in a new tab, and some phone browsers then show the picture instead of saving it, so
      // the page fetches the file and saves it itself (see saveOne).
      label: 'Download',
      icon: Download04Icon,
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share08Icon,
      // Only where the browser can hand files to the share sheet; elsewhere Download is the way.
      when: () => this.shareSupported,
    },
    {
      id: 'remove',
      label: 'Remove',
      icon: Delete02Icon,
      tone: 'danger',
      when: (_item, at) => this.shown()[at]?.canDelete ?? false,
    },
    // Report (App Store 1.2) on someone else's photo or clip. Block is offered inside the report
    // dialog: a fourth button here pushed the bar, and its close button, off a phone's screen.
    {
      id: 'report',
      label: 'Report',
      when: (_item, at) => this.reportable(this.shown()[at]),
    },
    // Without an account (a host on the emailed link) there is no report to send: the contact page.
    {
      id: 'report-contact',
      label: 'Report',
      href: () => '/contact',
      when: () => !this.mod.canReport(),
    },
  ];

  /**
   * Whether the open item can be reported: signed in and not the reader's own. Without the uploader's
   * account (older uploads), a guest's own photos are the ones they may remove; a host may remove
   * everything, so for them any item can be reported and the server refuses their own.
   */
  private reportable(photo: EventPhoto | undefined): boolean {
    if (!photo || !this.mod.canReport()) return false;
    if (photo.uploaderUserId) return this.mod.isOthers(photo.uploaderUserId);
    return !photo.canDelete || this.as() !== 'guest';
  }

  /** Opens the lightbox on one tile. */
  protected view(photo: EventPhoto): void {
    const at = this.shown().findIndex((p) => p.id === photo.id);
    if (at < 0) return;
    this.viewingAt.set(at);
    this.viewing.set(true);
  }

  protected onViewerAction(event: { id: string }): void {
    const photo = this.opened();
    if (!photo) return;
    if (event.id === 'download') {
      void this.saveOne(photo);
      return;
    }
    if (event.id === 'share') {
      void this.share([photo]);
      return;
    }
    if (event.id === 'report') {
      // Like removal below: the viewer is a modal in the top layer, so it stands down first or the
      // dialog would open behind it.
      this.viewing.set(false);
      const owner = photo.uploaderUserId
        ? { userId: photo.uploaderUserId, name: photo.uploaderName || 'this person' }
        : null;
      // The report dialog offers to block the uploader too.
      this.mod.askReport({ kind: 'photo', id: photo.id, noun: this.isVideo(photo) ? 'video' : 'photo', owner });
      return;
    }
    if (event.id !== 'remove') return;
    // The lightbox is a modal <dialog> in the top layer, which makes the rest of the page inert —
    // a confirm dialog raised over it would be both behind it and unclickable. So the viewer stands
    // down first, which is also where someone wants to end up after removing what they were looking
    // at: back at the grid.
    this.viewing.set(false);
    this.askToRemove(photo);
  }

  protected tileAlt(photo: EventPhoto): string {
    const what = this.isVideo(photo) ? 'Video' : 'Photo';
    return photo.uploaderName ? `${what} by ${photo.uploaderName}` : `Event ${what.toLowerCase()}`;
  }

  /** Which of the two a photo actually is. The server says; the browser never guesses. */
  protected isVideo(photo: EventPhoto): boolean {
    return (photo.contentType ?? '').startsWith('video/');
  }


  /** Held between "Remove" and confirming it, so a mis-tap at a party is recoverable. */
  protected readonly pendingRemoval = signal<EventPhoto | null>(null);
  protected readonly confirmingRemoval = signal(false);

  /**
   * Whether "download everything" can be offered — see {@link archivable} for why a bucket is not
   * simply allowed it.
   */
  protected readonly canArchive = computed(
    () =>
      this.archivable() ??
      // A bucket opened on its own may belong to a member rather than the owner, and the archive
      // route would refuse them; without an owner's say-so it stays hidden.
      this.as() !== 'bucket',
  );

  protected readonly isFavourites = computed(() => this.as() === 'favourites');

  /**
   * The box less what this reader reported (and the server hid for them) and whatever anyone they
   * blocked added: both leave the grid at once, and the server leaves them out of every later load.
   */
  protected readonly photos = computed(() =>
    (this.box()?.photos ?? []).filter(
      (p) => !this.mod.isHidden('photo', p.id) && !this.mod.isBlocked(p.uploaderUserId),
    ),
  );

  /**
   * The album's filters as sections of one panel (Uploaded by, Photos or videos): the toolbar has one
   * Filter button however many filters there are, and a new filter is a new section.
   */
  protected readonly filterSections = computed(() => albumFilterSections(this.photos()));
  /** What is chosen in the panel; the chips under the toolbar show it. */
  protected readonly filter = signal<UiFilterValue>({});
  /** The choices that still mean something (a person whose photos were all removed drops out). */
  private readonly activeFilter = computed(() => uiFilterPrune(this.filterSections(), this.filter()));
  protected readonly filterOn = computed(() => uiFilterCount(this.activeFilter()) > 0);
  /** "Aisha and Videos", for the empty result. */
  protected readonly filterWords = computed(() => describeAlbumFilter(this.filterSections(), this.activeFilter()));

  /** What the gallery, the viewer, "Select all" and Download work on. */
  protected readonly shown = computed(() => applyAlbumFilter(this.photos(), this.filterSections(), this.filter()));

  /** A change of filter keeps only the chosen photos that are still on screen. */
  protected setFilter(value: UiFilterValue): void {
    this.filter.set(value);
    const ids = new Set(this.shown().map((p) => p.id));
    this.selected.update((picked) => new Set([...picked].filter((id) => ids.has(id))));
  }

  /** With a filter on, Download saves what is shown, and says so. */
  protected readonly downloadLabel = computed(() =>
    this.filterOn() ? `Download ${this.shown().length === 1 ? 'this 1' : 'these ' + this.shown().length}` : 'Download all',
  );

  /** Columns on screen. Two on a phone and four on a big screen, until someone pinches. */
  protected readonly columnCount = signal(
    typeof matchMedia !== 'undefined' && matchMedia('(min-width: 48rem)').matches ? 4 : DEFAULT_COLUMNS,
  );

  /** Each picture's shape for the grid (height / width; very long shots are cropped). */
  protected readonly ratios = computed(() => this.shown().map((p) => tileHeightRatio(p.width, p.height)));
  /** Tiles keep their identity by photo, so a change of filter or size never reloads a picture. */
  protected readonly keyOf = (i: number): unknown => this.shown()[i]?.id ?? i;


  protected readonly canUpload = computed(() => this.box()?.canUpload ?? false);

  /**
   * Why the picker is not there. A bucket is open on its night and closed after it, and the control
   * used to simply vanish — which reads as a missing feature rather than a rule, and left the one
   * question a host actually has ("where do I put last night's photos") unanswered on the page that
   * should answer it.
   */
  protected readonly closedNote = computed(() => this.box()?.closedNote ?? null);

  /**
   * What is in the box, counted as the two things it actually holds. "14 photos" over a grid with
   * three clips in it is wrong in the one way people notice — they came back for the clips.
   */
  protected readonly countLabel = computed(() => {
    const videos = this.photos().filter((p) => this.isVideo(p)).length;
    const images = this.photos().length - videos;
    const parts: string[] = [];
    if (images) parts.push(images === 1 ? '1 photo' : `${images} photos`);
    if (videos) parts.push(videos === 1 ? '1 video' : `${videos} videos`);
    return parts.join(' · ');
  });

  /** What one item is called, for the copy that has to name it. */
  protected readonly pendingNoun = computed(() => {
    const photo = this.pendingRemoval();
    return photo && this.isVideo(photo) ? 'video' : 'photo';
  });

  /**
   * Picking-things-out mode. Off by default: the common act is opening a photo, and a grid that
   * selects on tap would make that the awkward one.
   */
  protected readonly selecting = signal(false);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly downloading = signal(false);

  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allSelected = computed(
    () => this.shown().length > 0 && this.selected().size === this.shown().length,
  );

  protected isSelected(photo: EventPhoto): boolean {
    return this.selected().has(photo.id);
  }

  protected startSelecting(): void {
    this.selecting.set(true);
    this.selected.set(new Set());
  }

  /** A long press: starts choosing with this photo, or toggles it when already choosing. */
  protected pressed(photo: EventPhoto): void {
    if (!this.canSelect()) return;
    if (!this.selecting()) {
      this.selecting.set(true);
      this.selected.set(new Set([photo.id]));
      return;
    }
    this.toggleSelected(photo);
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.shown().map((p) => p.id)));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  /** Whether this browser can hand files to the phone's share sheet. Read once. */
  protected readonly shareSupported = canShareFiles();

  /** The selected photos, in the grid's order. */
  private picked(): EventPhoto[] {
    const ids = this.selected();
    return this.shown().filter((p) => ids.has(p.id));
  }

  /** The ones selected that this person may remove (the server says, per photo). */
  private readonly removable = computed(() => {
    const ids = this.selected();
    return this.shown().filter((p) => ids.has(p.id) && p.canDelete);
  });

  /** Choosing is worth offering when there is something to do with a choice. */
  protected readonly canSelect = computed(
    () => this.photos().length > 0 && (this.canArchive() || this.shareSupported || this.photos().some((p) => p.canDelete)),
  );

  protected readonly selectionActions = computed<UiSelectionAction[]>(() => {
    const busy = this.downloading() || this.preparing();
    const actions: UiSelectionAction[] = [];
    if (this.shareSupported) actions.push({ id: 'share', label: 'Share', icon: Share08Icon, enabled: !busy });
    if (this.canArchive()) actions.push({ id: 'download', label: 'Download', icon: Download04Icon, enabled: !busy });
    // Remove only when something chosen is this person's to remove; the rest stay.
    if (this.removable().length) actions.push({ id: 'remove', label: 'Remove', icon: Delete02Icon, danger: true, enabled: !busy });
    if (this.isFavourites()) actions.push({ id: 'unfavourite', label: 'Remove from favourites', icon: HeartbreakIcon, enabled: !busy });
    return actions;
  });

  protected onSelectionAction(id: string): void {
    if (id === 'share') void this.share(this.picked());
    else if (id === 'download') this.downloadSelected();
    else if (id === 'remove') this.askToRemoveSelected();
    else if (id === 'unfavourite') this.unfavouriteSelected();
  }

  // --- Share ------------------------------------------------------------------------------------

  protected readonly preparing = signal(false);
  protected readonly prepareStopping = signal(false);
  protected readonly prepareDone = signal(0);
  protected readonly prepareTotal = signal(0);
  protected readonly prepareTitle = signal('Getting your photos ready');
  protected readonly readyToShare = signal(false);
  private readyFiles: File[] | null = null;
  private prepareAbort: AbortController | null = null;

  /**
   * Fetches the originals, then opens the share sheet with them. A browser only opens it from a tap
   * (user activation), and fetching many files can outlast that; then one more tap on "Share" does it.
   */
  protected async share(photos: EventPhoto[]): Promise<void> {
    if (!photos.length || this.preparing()) return;
    const refusal = shareRefusal(photos);
    if (refusal) {
      this.toast.danger(refusal);
      return;
    }
    const files = await this.fetchWithProgress(photos, photos.length === 1 ? 'Getting it ready' : 'Getting your photos ready');
    if (!files) return;
    if (stillActive()) {
      await this.openShareSheet(files);
    } else {
      this.offerShare(files);
    }
  }

  private offerShare(files: File[]): void {
    this.readyFiles = files;
    this.readyTitle.set(files.length === 1 ? 'Ready to share' : `${files.length} ready to share`);
    this.readyToShare.set(true);
  }

  protected readonly readyTitle = signal('Ready to share');
  protected readonly readyMessage = computed(() =>
    this.readyTitle() === 'Ready to share' ? 'Tap Share to choose where it goes.' : 'Tap Share to choose where they go.',
  );

  /** The second tap: runs inside its click, so the browser lets the share sheet open. */
  protected shareReady(): void {
    const files = this.readyFiles;
    this.readyFiles = null;
    if (files) void this.openShareSheet(files);
  }

  protected dropReady(): void {
    this.readyFiles = null;
  }

  private async openShareSheet(files: File[]): Promise<void> {
    const outcome = await shareFiles(files);
    if (outcome === 'needs-tap') {
      this.offerShare(files);
    } else if (outcome === 'shared') {
      if (this.selecting()) this.stopSelecting();
    } else if (outcome === 'unsupported') {
      this.toast.danger("This browser can't share these files. Download them instead.");
    } else if (outcome === 'failed') {
      this.toast.danger('Sharing didn’t work. Try again, or download them.');
    }
    // 'dismissed': they closed the sheet; nothing to say.
  }

  protected cancelPrepare(): void {
    this.prepareAbort?.abort();
  }

  /** Downloads originals into the tab with the progress dialog up; null when stopped or failed. */
  private async fetchWithProgress(photos: EventPhoto[], title: string): Promise<File[] | null> {
    const abort = new AbortController();
    this.prepareAbort = abort;
    this.prepareTitle.set(title);
    this.prepareDone.set(0);
    this.prepareTotal.set(photos.length);
    this.prepareStopping.set(false);
    this.preparing.set(true);
    try {
      return await fetchOriginals(photos, abort.signal, (done) => this.prepareDone.set(done));
    } catch (e) {
      if (!abort.signal.aborted) this.toast.danger(e instanceof Error && e.message ? e.message : 'That didn’t work. Try again.');
      return null;
    } finally {
      this.preparing.set(false);
      this.prepareStopping.set(false);
      this.prepareAbort = null;
    }
  }

  /**
   * Saves one original as a file. Fetched and handed over as a blob link with no new tab, so every
   * browser saves it (a plain link to the picture opens it on some phones).
   */
  protected async saveOne(photo: EventPhoto): Promise<void> {
    if (this.preparing()) return;
    const files = await this.fetchWithProgress([photo], this.isVideo(photo) ? 'Getting the video' : 'Getting the photo');
    const file = files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Long enough for the browser to start the save.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    this.toast.success(this.isVideo(photo) ? 'Video downloaded.' : 'Photo downloaded.');
  }

  // --- Remove the selection ----------------------------------------------------------------------

  protected readonly confirmingBulkRemoval = signal(false);
  protected readonly bulkRemoveTitle = computed(() => {
    const n = this.removable().length;
    return n === 1 ? 'Remove 1 item?' : `Remove ${n} items?`;
  });
  protected readonly bulkRemoveMessage = computed(() => {
    const others = this.selected().size - this.removable().length;
    return (
      "They disappear from everyone's album. This cannot be undone." +
      (others > 0 ? ` The other ${others} selected aren't yours to remove and stay.` : '')
    );
  });

  protected askToRemoveSelected(): void {
    if (this.removable().length) this.confirmingBulkRemoval.set(true);
  }

  /** Removes the selected ones this person may remove, one at a time; stops at the first refusal. */
  protected async removeSelected(): Promise<void> {
    const mine = this.removable();
    let removed = 0;
    for (const photo of mine) {
      try {
        await new Promise<void>((resolve, reject) =>
          this.removeRequest(photo).subscribe({ next: () => resolve(), error: (e) => reject(e) }),
        );
        this.dropFromBox(photo);
        removed++;
      } catch {
        // The API service already said why.
        break;
      }
    }
    if (removed) this.contentsChanged.emit();
    if (removed === mine.length) this.toast.success(removed === 1 ? '1 item removed.' : `${removed} items removed.`);
    this.stopSelecting();
  }

  protected stopSelecting(): void {
    this.selecting.set(false);
    this.selected.set(new Set());
  }

  protected toggleSelected(photo: EventPhoto): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(photo.id)) next.add(photo.id);
      return next;
    });
  }

  protected toggleSelectAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.shown().map((p) => p.id)));
  }

  /** Everything in the box, or, with a filter on, everything shown. */
  protected downloadAll(): void {
    if (this.filterOn()) {
      const ids = this.shown().map((p) => p.id);
      if (ids.length) this.download(ids);
      return;
    }
    this.download([]);
  }

  /** Just what is ticked. */
  protected downloadSelected(): void {
    const ids = [...this.selected()];
    if (ids.length) this.download(ids);
  }

  /**
   * Asks the server for a link to a zip and lets the browser save it.
   *
   * <p>The browser's own download manager fetches the link, so the zip streams to disk with the
   * browser's progress, however big the album is. The page used to fetch the zip itself, which held
   * the whole archive in the tab's memory and showed nothing until it ended.</p>
   */
  private download(ids: string[]): void {
    if (this.downloading()) return;

    if (this.isFavourites()) {
      const wanted = ids.length ? ids : this.shown().map((p) => p.id);
      if (!wanted.length) return;
      this.downloading.set(true);
      this.api.favouritesDownloadLink(wanted).subscribe({
        next: (archive) => this.startArchive(archive),
        error: () => {
          this.downloading.set(false);
          this.toast.danger('That download could not be prepared. Try again.');
        },
      });
      return;
    }

    // There is no bucket-scoped archive route, so a bucket asks the CAMPAIGN's — which means naming
    // the campaign (this component's own id is the bucket in that mode) and naming every photo,
    // because an empty id list means "the whole event" and would hand back the other buckets too.
    const mode = this.as();
    const bucket = mode === 'bucket';
    const campaignId = bucket ? (this.box()?.campaignId ?? '') : this.campaignId();
    const wanted = bucket && ids.length === 0 ? this.photos().map((p) => p.id) : ids;
    if (!campaignId || (bucket && wanted.length === 0)) return;

    this.downloading.set(true);

    this.api.eventPhotosDownloadLink(campaignId, bucket ? 'host' : (mode as 'host' | 'guest'), wanted).subscribe({
      next: (archive) => this.startArchive(archive),
      error: () => {
        this.downloading.set(false);
        this.toast.danger('That download could not be prepared. Try again.');
      },
    });
  }

  private startArchive(archive: { url: string; count: number; bytes: number }): void {
    // The server names the file (Content-Disposition), so the page stays where it is.
    const link = document.createElement('a');
    link.href = archive.url;
    link.rel = 'noopener';
    link.click();

    this.downloading.set(false);
    this.stopSelecting();
    const what = archive.count === 1 ? '1 photo' : `${archive.count} photos`;
    this.toast.success(`Downloading ${what} (${formatBytes(archive.bytes)}). Your browser shows the progress.`);
  }

  /** Takes the chosen items out of the reader's Favourites (nothing leaves the album itself). */
  protected unfavouriteSelected(): void {
    const chosen = this.picked();
    if (!chosen.length) return;
    const ids = new Set(chosen.map((p) => p.id));
    const before = this.box();
    this.box.update((box) => (box ? { ...box, photos: box.photos.filter((p) => !ids.has(p.id)), count: box.count - ids.size } : box));
    this.stopSelecting();
    Promise.all(chosen.map((p) => firstValueFrom(this.api.unfavourite(p.id)))).then(
      () => this.toast.success(ids.size === 1 ? 'Removed from your favourites.' : `${ids.size} removed from your favourites.`),
      () => {
        this.box.set(before);
        this.toast.danger('Some of those didn’t come off your favourites. Try again.');
      },
    );
  }

  /** Every page of the reader's Favourites, as one box the grid already knows how to draw. */
  private async loadFavourites(): Promise<EventPhotoBox> {
    const photos: EventPhoto[] = [];
    for (let page = 1; ; page++) {
      const got = await firstValueFrom(this.api.myFavourites(page, 200));
      photos.push(...got.items);
      if (photos.length >= got.totalCount || got.items.length === 0) break;
    }
    return { campaignId: '', eventTitle: 'Favourites', count: photos.length, canUpload: false, photos };
  }

  // ngOnInit, not the constructor: an input has no value until after construction, so reading
  // campaignId there would fetch the box for an empty id.
  ngOnInit(): void {
    this.loading.set(true);
    if (this.isFavourites()) {
      this.loadFavourites().then(
        (box) => {
          this.box.set(box);
          this.loading.set(false);
        },
        () => this.loading.set(false),
      );
      return;
    }
    const request =
      this.as() === 'bucket'
        ? this.api.mediaBucketMedia(this.campaignId())
        : this.as() === 'host'
          ? this.api.campaignPhotos(this.campaignId())
          : this.api.invitationPhotos(this.campaignId());

    request.subscribe({
      next: (box) => {
        this.box.set(box);
        this.loading.set(false);
      },
      // The API service already surfaced the reason; an empty box beats a page that never resolves.
      error: () => this.loading.set(false),
    });
  }

  /**
   * The ceiling `EventPhotoService` enforces on a clip, checked here too so an oversized pick is
   * refused before the browser spends minutes uploading it only to be told no.
   */
  private static readonly MaxVideoBytes = 256 * 1024 * 1024;

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    // Clearing the input matters: picking the same photo twice in a row is otherwise a no-op,
    // because the change event never fires for an unchanged value.
    input.value = '';
    if (!picked.length) return;

    const tooBig = (f: File): boolean =>
      f.type.startsWith('video/') && f.size > PhotoBoxComponent.MaxVideoBytes;
    const oversized = picked.filter(tooBig);
    const sendable = picked.filter((f) => !tooBig(f));
    if (oversized.length) {
      this.toast.danger(
        oversized.length === 1
          ? `“${oversized[0].name}” is too long to upload.`
          : `${oversized.length} clips are too long to upload.`,
      );
    }
    if (!sendable.length) return;

    // Each goes on its own, straight to storage where it can, so a big pick on a poor connection
    // can't lose the lot. A video's still is drawn on the server, which reads every format a phone makes.
    void this.sendPhotos(() => this.queue.send(sendable));
  }

  /** Runs a batch through the queue, then says how many landed. */
  private async sendPhotos(run: () => Promise<void>): Promise<void> {
    const before = this.landed;
    await run();
    const count = this.landed - before;
    if (count) this.toast.success(count === 1 ? '1 item added.' : `${count} items added.`);
  }

  protected retryFailed(): void {
    void this.sendPhotos(() => this.queue.retryFailed());
  }

  /** Newest first, matching the order the server returns the box in. */
  private addToBox(added: EventPhoto[]): void {
    this.box.update((box) =>
      box ? { ...box, photos: [...added, ...box.photos], count: box.count + added.length } : box,
    );
    this.contentsChanged.emit();
  }

  private linkFor(file: File): Observable<DirectUploadTicket> {
    if (this.as() === 'bucket') return this.api.mediaBucketLink(this.campaignId(), file);
    return this.as() === 'host'
      ? this.api.campaignPhotoLink(this.campaignId(), file)
      : this.api.invitationPhotoLink(this.campaignId(), file);
  }

  /** Whichever door this instance came through. The server decides who may add; this picks the URL. */
  private send(files: File[], poster?: Blob | null): Observable<EventPhoto[]> {
    if (this.as() === 'bucket') {
      return this.api.addMediaBucketMedia(this.campaignId(), files, poster);
    }
    return this.as() === 'host'
      ? this.api.addCampaignPhotos(this.campaignId(), files, poster)
      : this.api.addInvitationPhotos(this.campaignId(), files, poster);
  }

  protected askToRemove(photo: EventPhoto): void {
    this.pendingRemoval.set(photo);
    this.confirmingRemoval.set(true);
  }

  protected remove(): void {
    const photo = this.pendingRemoval();
    if (!photo) return;
    this.removeRequest(photo).subscribe({
      next: () => {
        this.dropFromBox(photo);
        this.pendingRemoval.set(null);
        this.contentsChanged.emit();
      },
      error: () => this.pendingRemoval.set(null),
    });
  }

  /** Whichever door this instance came through; the server decides who may remove what. */
  private removeRequest(photo: EventPhoto): Observable<unknown> {
    return this.as() === 'bucket'
      ? this.api.removeMediaBucketMedia(this.campaignId(), photo.id)
      : this.as() === 'host'
        ? this.api.removeCampaignPhoto(this.campaignId(), photo.id)
        : this.api.removeInvitationPhoto(this.campaignId(), photo.id);
  }

  /** Takes a removed photo out of the grid, the viewer's position and the selection. */
  private dropFromBox(photo: EventPhoto): void {
    this.box.update((box) =>
      box ? { ...box, photos: box.photos.filter((p) => p.id !== photo.id), count: box.count - 1 } : box,
    );
    // The lightbox holds a position, not a photo, so a shorter list must not leave it pointing
    // past the end of one.
    this.viewingAt.update((at) => Math.max(0, Math.min(at, this.shown().length - 1)));
    // A removed photo must leave the selection too, or the count keeps promising a file that is no
    // longer there.
    this.selected.update((current) => {
      if (!current.has(photo.id)) return current;
      const next = new Set(current);
      next.delete(photo.id);
      return next;
    });
  }
}

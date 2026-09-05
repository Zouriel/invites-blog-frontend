import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Download04Icon from '@hugeicons/core-free-icons/Download04Icon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiMediaAction, UiMediaItem, UiMediaLightbox } from '@zouriel/ui/file-viewer';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { catchError, concat, defer, Observable, of, switchMap, toArray } from 'rxjs';
import { ApiService } from '../api/api.service';
import { posterFrameFor } from '../utils/poster-frame';
import { EventPhoto, EventPhotoBox } from '../utils/types/api.types';

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
    UiMediaLightbox,
    UiSpinner,
    UiText,
  ],
  templateUrl: './photo-box.component.html',
  styleUrl: './photo-box.component.scss',
})
export class PhotoBoxComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly removeIcon = Cancel01Icon;
  protected readonly downloadIcon = Download04Icon;
  protected readonly tickIcon = Tick02Icon;
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
  readonly as = input.required<'host' | 'guest' | 'bucket'>();

  /** Heading above the grid. Omitted where the surrounding page already says whose event this is. */
  readonly heading = input<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly box = signal<EventPhotoBox | null>(null);

  /** Whether the lightbox is up, and which of the photos it is showing. */
  protected readonly viewing = signal(false);
  protected readonly viewingAt = signal(0);

  /** The photo the lightbox is on, if it is up. */
  protected readonly opened = computed(() =>
    this.viewing() ? (this.photos()[this.viewingAt()] ?? null) : null,
  );

  /**
   * The box as the lightbox wants it: the same list, said its way.
   *
   * <p>The viewing copy rather than the original, deliberately — a phone opening a 12-megapixel
   * original for every swipe would spend the night downloading. The original is what the download
   * action hands over, and only when asked for.</p>
   */
  protected readonly items = computed<UiMediaItem[]>(() =>
    this.photos().map((photo) => ({
      src: photo.url,
      thumb: photo.thumbUrl,
      kind: this.isVideo(photo) ? 'video' : 'image',
      alt: this.tileAlt(photo),
      caption: photo.uploaderName ? `From ${photo.uploaderName}` : undefined,
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
      label: 'Download original',
      // The ORIGINAL, not the viewing copy the lightbox is showing: the point of keeping the shot as
      // taken is that this is what someone gets back.
      href: (_item, at) => this.photos()[at]?.originalUrl ?? '',
      download: (_item, at) => {
        const photo = this.photos()[at];
        return photo ? this.downloadName(photo) : '';
      },
    },
    {
      id: 'remove',
      label: 'Remove',
      tone: 'danger',
      when: (_item, at) => this.photos()[at]?.canDelete ?? false,
    },
  ];

  /** Opens the lightbox on one tile. */
  protected view(photo: EventPhoto): void {
    const at = this.photos().findIndex((p) => p.id === photo.id);
    if (at < 0) return;
    this.viewingAt.set(at);
    this.viewing.set(true);
  }

  protected onViewerAction(event: { id: string }): void {
    // Download is an anchor the lightbox renders itself; only removal needs answering here.
    const photo = this.opened();
    if (event.id !== 'remove' || !photo) return;
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
   * Whether "download everything" can be offered. The archive is built by a campaign-scoped
   * endpoint, so a bucket opened on its own has nothing to point at — see the note in the template.
   */
  protected readonly canArchive = computed(() => this.as() !== 'bucket');

  protected readonly photos = computed(() => this.box()?.photos ?? []);
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
    return parts.length ? parts.join(' · ') : 'Nothing';
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
    () => this.photos().length > 0 && this.selected().size === this.photos().length,
  );

  protected isSelected(photo: EventPhoto): boolean {
    return this.selected().has(photo.id);
  }

  protected startSelecting(): void {
    this.selecting.set(true);
    this.selected.set(new Set());
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
    this.selected.set(this.allSelected() ? new Set() : new Set(this.photos().map((p) => p.id)));
  }

  /** Everything in the box. */
  protected downloadAll(): void {
    this.download([]);
  }

  /** Just what is ticked. */
  protected downloadSelected(): void {
    const ids = [...this.selected()];
    if (ids.length) this.download(ids);
  }

  /**
   * Asks the server for a zip and hands it to the browser.
   *
   * <p>The archive arrives as a blob rather than through a plain link because it is built behind the
   * session, which a navigation would not carry. That means the save has to be triggered here: a
   * temporary object URL, one synthetic click, and the URL revoked straight after so the blob is not
   * pinned in memory for the life of the tab — an event's originals can run to gigabytes.</p>
   */
  private download(ids: string[]): void {
    if (this.downloading()) return;

    // Bucket mode has no archive endpoint to ask — the button is hidden, and this is the guard that
    // makes that a fact rather than a hope.
    const mode = this.as();
    if (mode === 'bucket') return;

    this.downloading.set(true);

    this.api.downloadEventPhotos(this.campaignId(), mode, ids).subscribe({
      next: ({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);

        this.downloading.set(false);
        this.stopSelecting();
        this.toast.success(
          ids.length === 0
            ? 'Downloading every photo.'
            : ids.length === 1
              ? 'Downloading 1 photo.'
              : `Downloading ${ids.length} photos.`,
        );
      },
      error: () => {
        this.downloading.set(false);
        // The blob response means the interceptor could not read the reason out of the body.
        this.toast.danger('That download could not be prepared. Try again.');
      },
    });
  }

  // ngOnInit, not the constructor: an input has no value until after construction, so reading
  // campaignId there would fetch the box for an empty id.
  ngOnInit(): void {
    this.loading.set(true);
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

    const isVideo = (f: File): boolean => f.type.startsWith('video/');
    const images = picked.filter((f) => !isVideo(f));
    const clips = picked.filter(isVideo);

    const oversized = clips.filter((f) => f.size > PhotoBoxComponent.MaxVideoBytes);
    const sendable = clips.filter((f) => f.size <= PhotoBoxComponent.MaxVideoBytes);
    if (oversized.length) {
      this.toast.danger(
        oversized.length === 1
          ? `“${oversized[0].name}” is too long to upload.`
          : `${oversized.length} clips are too long to upload.`,
      );
    }
    if (!images.length && !sendable.length) return;

    // Images go up together the way they always have — a phone's picker hands back a batch and one
    // request is the whole point. Each clip goes on its own, because it travels with the still drawn
    // for it and that still means nothing next to any other file.
    //
    // Sequential rather than parallel: a clip is buffered whole on both ends, so several large ones
    // in flight at once is the shape of the memory risk on the server and of a stalled upload here.

    // One failure must not lose the rest. `unwrap` has already said what went wrong, so a failed
    // leg becomes an empty result and the queue keeps going — a bad clip in the middle of a pick
    // should not discard the photographs either side of it.
    const survive = (o: Observable<EventPhoto[]>): Observable<EventPhoto[]> =>
      o.pipe(catchError(() => of([] as EventPhoto[])));

    const uploads: Observable<EventPhoto[]>[] = [];
    if (images.length) uploads.push(survive(this.send(images)));
    for (const clip of sendable) {
      uploads.push(
        defer(async () => await posterFrameFor(clip)).pipe(
          switchMap((poster) => {
            // No still means no decoder for this container. The server would refuse it anyway, and
            // saying so here names the file rather than failing the whole pick.
            if (!poster) {
              this.toast.danger(`We couldn't read “${clip.name}”.`);
              return of([] as EventPhoto[]);
            }
            return survive(this.send([clip], poster));
          }),
        ),
      );
    }

    this.uploading.set(true);
    concat(...uploads)
      .pipe(toArray())
      .subscribe({
        next: (batches) => {
          const added = batches.flat();
          this.uploading.set(false);
          if (!added.length) return;
          // Newest first, matching the order the server returns the box in.
          this.box.update((box) =>
            box
              ? { ...box, photos: [...added, ...box.photos], count: box.count + added.length }
              : box,
          );
          this.toast.success(added.length === 1 ? '1 item added.' : `${added.length} items added.`);
        },
        error: () => this.uploading.set(false),
      });
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

  /**
   * What the saved file is called. The extension comes off the stored URL rather than being assumed:
   * the box keeps whatever format was uploaded, so a hardcoded `.jpg` would mislabel every PNG.
   */
  protected downloadName(photo: EventPhoto): string {
    const ext = photo.originalUrl.split('.').pop();
    return ext && ext.length <= 5 ? `photo-${photo.id}.${ext}` : `photo-${photo.id}`;
  }

  protected askToRemove(photo: EventPhoto): void {
    this.pendingRemoval.set(photo);
    this.confirmingRemoval.set(true);
  }

  protected remove(): void {
    const photo = this.pendingRemoval();
    if (!photo) return;

    const request =
      this.as() === 'bucket'
        ? this.api.removeMediaBucketMedia(this.campaignId(), photo.id)
        : this.as() === 'host'
          ? this.api.removeCampaignPhoto(this.campaignId(), photo.id)
          : this.api.removeInvitationPhoto(this.campaignId(), photo.id);

    request.subscribe({
      next: () => {
        this.box.update((box) =>
          box
            ? { ...box, photos: box.photos.filter((p) => p.id !== photo.id), count: box.count - 1 }
            : box,
        );
        // The lightbox holds a position, not a photo, so a shorter list must not leave it pointing
        // past the end of one.
        this.viewingAt.update((at) => Math.max(0, Math.min(at, this.photos().length - 1)));
        // A removed photo must leave the selection too, or the count keeps promising a file that
        // is no longer there — "Download 3" over a grid of two.
        this.selected.update((current) => {
          if (!current.has(photo.id)) return current;
          const next = new Set(current);
          next.delete(photo.id);
          return next;
        });
        this.pendingRemoval.set(null);
      },
      error: () => this.pendingRemoval.set(null),
    });
  }
}

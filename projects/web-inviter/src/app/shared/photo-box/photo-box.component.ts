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
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiImageViewer } from '@zouriel/ui/file-viewer';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
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
 */
@Component({
  selector: 'app-photo-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiButton, UiConfirmDialog, UiEmptyState, UiImageViewer, UiModal, UiSpinner, UiText],
  templateUrl: './photo-box.component.html',
  styleUrl: './photo-box.component.scss',
})
export class PhotoBoxComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly removeIcon = Cancel01Icon;
  protected readonly downloadIcon = Download04Icon;
  protected readonly tickIcon = Tick02Icon;

  readonly campaignId = input.required<string>();

  /**
   * Which door this instance came through. 'host' is the dashboard, authorised by owning the
   * campaign; 'guest' is an invitation, authorised by being on its guest list. The server enforces
   * both — this only picks the matching route.
   */
  readonly as = input.required<'host' | 'guest'>();

  /** Heading above the grid. Omitted where the surrounding page already says whose event this is. */
  readonly heading = input<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly box = signal<EventPhotoBox | null>(null);

  /** The photo the lightbox is showing, if any. */
  protected readonly opened = signal<EventPhoto | null>(null);

  /**
   * Where the open photo sits in the grid, or -1 when nothing is open.
   *
   * <p>Derived from the list rather than stored beside it, so a photo removed from under the
   * lightbox cannot leave the position pointing at a gap.</p>
   */
  protected readonly openedAt = computed(() => {
    const photo = this.opened();
    return photo ? this.photos().findIndex((p) => p.id === photo.id) : -1;
  });

  protected readonly hasPrevious = computed(() => this.openedAt() > 0);
  protected readonly hasNext = computed(
    () => this.openedAt() >= 0 && this.openedAt() < this.photos().length - 1,
  );

  /** What the lightbox is called: whose photo it is, and where you are in the box. */
  protected readonly openedTitle = computed(() => {
    const photo = this.opened();
    if (!photo) return 'Event photo';
    const whose = photo.uploaderName ? `Photo by ${photo.uploaderName}` : 'Event photo';
    const total = this.photos().length;
    return total > 1 ? `${whose} · ${this.openedAt() + 1} of ${total}` : whose;
  });

  /** Steps the lightbox along. The viewer reports the swipe; the list lives here, so the move does too. */
  protected step(by: -1 | 1): void {
    const to = this.photos()[this.openedAt() + by];
    if (to) this.opened.set(to);
  }

  /** Held between "Remove" and confirming it, so a mis-tap at a party is recoverable. */
  protected readonly pendingRemoval = signal<EventPhoto | null>(null);
  protected readonly confirmingRemoval = signal(false);

  protected readonly photos = computed(() => this.box()?.photos ?? []);
  protected readonly canUpload = computed(() => this.box()?.canUpload ?? false);

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
    this.downloading.set(true);

    this.api.downloadEventPhotos(this.campaignId(), this.as(), ids).subscribe({
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
      this.as() === 'host'
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

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Clearing the input matters: picking the same photo twice in a row is otherwise a no-op,
    // because the change event never fires for an unchanged value.
    input.value = '';
    if (!files.length) return;

    this.uploading.set(true);
    const request =
      this.as() === 'host'
        ? this.api.addCampaignPhotos(this.campaignId(), files)
        : this.api.addInvitationPhotos(this.campaignId(), files);

    request.subscribe({
      next: (added) => {
        // Newest first, matching the order the server returns the box in.
        this.box.update((box) =>
          box ? { ...box, photos: [...added, ...box.photos], count: box.count + added.length } : box,
        );
        this.uploading.set(false);
        this.toast.success(added.length === 1 ? 'Photo added.' : `${added.length} photos added.`);
      },
      error: () => this.uploading.set(false),
    });
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
      this.as() === 'host'
        ? this.api.removeCampaignPhoto(this.campaignId(), photo.id)
        : this.api.removeInvitationPhoto(this.campaignId(), photo.id);

    request.subscribe({
      next: () => {
        this.box.update((box) =>
          box
            ? { ...box, photos: box.photos.filter((p) => p.id !== photo.id), count: box.count - 1 }
            : box,
        );
        if (this.opened()?.id === photo.id) this.opened.set(null);
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

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
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
  imports: [UiButton, UiConfirmDialog, UiEmptyState, UiImageViewer, UiModal, UiSpinner, UiText],
  templateUrl: './photo-box.component.html',
  styleUrl: './photo-box.component.scss',
})
export class PhotoBoxComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

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

  /** Held between "Remove" and confirming it, so a mis-tap at a party is recoverable. */
  protected readonly pendingRemoval = signal<EventPhoto | null>(null);
  protected readonly confirmingRemoval = signal(false);

  protected readonly photos = computed(() => this.box()?.photos ?? []);
  protected readonly canUpload = computed(() => this.box()?.canUpload ?? false);

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
        this.pendingRemoval.set(null);
      },
      error: () => this.pendingRemoval.set(null),
    });
  }
}

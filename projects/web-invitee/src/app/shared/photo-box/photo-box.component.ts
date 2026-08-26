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
 * An event's photo box (§5), as a guest on a shared campaign link sees it — everything anyone shot
 * at the event, and a way to add their own.
 *
 * <p>The guest-only half of the box the signed-in app also shows: there is no host mode here,
 * because this app is only ever a guest. Authorisation is the server's: it matches the caller's
 * verified contact to a row on the campaign's guest list, and `canDelete` arrives per photo rather
 * than being worked out in the browser.</p>
 *
 * <p><b>This is a near-duplicate of the same component in the signed-in app, deliberately.</b> The
 * two apps share no library, and FUTURE-PLANS §2 dissolves this one into the render app — so the
 * cost of the duplicate is bounded and the cost of building a shared library for it would not be.
 * If §2 slips, that trade stops being true.</p>
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
    this.api.eventPhotos(this.campaignId()).subscribe({
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
    this.api.addEventPhotos(this.campaignId(), files).subscribe({
      next: (added) => {
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

    this.api.removeEventPhoto(this.campaignId(), photo.id).subscribe({
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

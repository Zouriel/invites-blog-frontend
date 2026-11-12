import { UiEmptyState } from '@zouriel/ui/feedback';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal } from '@zouriel/ui/dialog';
import { UiCheckbox, UiSearchInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { BucketPanelComponent } from '../bucket-panel/bucket-panel.component';
import { BucketAccess, MediaBucket } from '../utils/types/api.types';

/**
 * Everything about one album, opened from the gear on its tab: its name, codes and size (the
 * bucket panel), and which of the event's guests may look into it (Platinum pass and venues).
 *
 * <p>Access is managed from the bucket's side: every guest on the event with a switch. The event's
 * organiser and the people it is for always see every bucket, so they are not listed.</p>
 */
@Component({
  selector: 'app-bucket-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, BucketPanelComponent, UiEmptyState, UiButton, UiCheckbox, UiConfirmDialog, UiModal, UiSearchInput, UiSpinner, UiSwitch, UiText],
  templateUrl: './bucket-settings.component.html',
  styleUrl: './bucket-settings.component.scss',
})
export class BucketSettingsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly bucket = input.required<MediaBucket>();
  readonly changed = output<MediaBucket>();

  protected readonly access = signal<BucketAccess | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly query = signal('');

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const guests = this.access()?.guests ?? [];
    if (!q) return guests;
    return guests.filter((g) => [g.name, ...g.roles].some((v) => v.toLowerCase().includes(q)));
  });

  /**
   * Whether guests can be switched off: private albums come with a Platinum pass or a venue. An album
   * already closed can always be opened again, so the switches that turn someone back ON stay live.
   */
  protected readonly canClose = computed(() => this.bucket().privateAlbums);

  protected readonly allowedCount = computed(() => (this.access()?.guests ?? []).filter((g) => g.allowed).length);

  /** What the face switch shows. Changes only here, so a cancelled confirm can put it back. */
  protected readonly faceSwitch = signal(false);
  protected readonly faceAvailable = computed(() => this.bucket().faceGroupingAvailable === true);
  /** Free events see the switch but can't use it. An older server that doesn't say is taken as included. */
  protected readonly faceIncluded = computed(() => this.bucket().faceGroupingIncluded !== false);
  protected readonly askingFacesOn = signal(false);
  protected readonly askingFacesOff = signal(false);
  protected readonly faceBusy = signal(false);
  /** The host's tick that guests are told; required to switch grouping on. */
  protected guestsTold = false;
  /** The host's tick that the event is outside Illinois, Texas and Washington; also required. */
  protected outsideRegions = false;
  protected readonly canTurnOn = () => this.guestsTold && this.outsideRegions;

  /** The switch was flipped: nothing changes until the confirm. */
  protected faceFlipped(on: boolean): void {
    this.faceSwitch.set(on);
    if (on) {
      this.guestsTold = false;
      this.outsideRegions = false;
      this.askingFacesOn.set(true);
    } else {
      this.askingFacesOff.set(true);
    }
  }

  /** The confirm closed without a yes: the switch goes back to what is saved. */
  protected faceCancelled(): void {
    this.askingFacesOn.set(false);
    this.askingFacesOff.set(false);
    this.faceSwitch.set(!!this.bucket().faceGrouping);
  }

  protected saveFaces(on: boolean): void {
    if (this.faceBusy() || (on && !this.canTurnOn())) return;
    this.faceBusy.set(true);
    this.api.setBucketFaceGrouping(this.bucket().id, on, on ? this.guestsTold : false, on ? this.outsideRegions : false).subscribe({
      next: (b) => {
        this.faceBusy.set(false);
        this.askingFacesOn.set(false);
        this.askingFacesOff.set(false);
        this.faceSwitch.set(!!b.faceGrouping);
        this.changed.emit(b);
      },
      error: () => {
        this.faceBusy.set(false);
        this.faceCancelled();
      },
    });
  }

  ngOnInit(): void {
    this.faceSwitch.set(!!this.bucket().faceGrouping);
    this.api.bucketAccess(this.bucket().id).subscribe({
      next: (a) => this.access.set(a),
      error: () => this.failed.set(true),
    });
  }

  protected set(guestIds: string[], allowed: boolean): void {
    if (this.busy() || !guestIds.length) return;
    this.busy.set(true);
    this.api.setBucketAccess(this.bucket().id, guestIds, allowed).subscribe({
      next: (a) => {
        this.access.set(a);
        this.busy.set(false);
      },
      error: () => {
        // Put the switches back from the truth; the toast has already said why.
        this.access.update((a) => (a ? { ...a, guests: [...a.guests] } : a));
        this.busy.set(false);
      },
    });
  }

  /** Allow or stop everyone currently shown, so a search narrows what the buttons act on. */
  protected setShown(allowed: boolean): void {
    this.set(
      this.shown().filter((g) => g.allowed !== allowed).map((g) => g.guestId),
      allowed,
    );
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiSearchInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { BucketPanelComponent } from '../bucket-panel/bucket-panel.component';
import { BucketAccess, MediaBucket } from '../utils/types/api.types';

/**
 * Everything about one album, opened from the gear on its tab: its name, codes and size (the
 * bucket panel), and which of the event's guests may look into it (Wedding pass and venues).
 *
 * <p>Access is managed from the bucket's side: every guest on the event with a switch. The event's
 * organiser and the people it is for always see every bucket, so they are not listed.</p>
 */
@Component({
  selector: 'app-bucket-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, BucketPanelComponent, UiButton, UiSearchInput, UiSpinner, UiSwitch, UiText],
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
   * Whether guests can be switched off: private albums come with a Wedding pass or a venue. An album
   * already closed can always be opened again, so the switches that turn someone back ON stay live.
   */
  protected readonly canClose = computed(() => this.bucket().privateAlbums);

  protected readonly allowedCount = computed(() => (this.access()?.guests ?? []).filter((g) => g.allowed).length);

  ngOnInit(): void {
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

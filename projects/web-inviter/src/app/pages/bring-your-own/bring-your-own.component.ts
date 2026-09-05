import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';

/**
 * Bring your own design.
 *
 * <p>The disclaimer is the point of this page, not decoration on it. Someone arriving here has a
 * finished picture and no idea that the platform normally rewrites the words inside an invitation
 * per guest — so they have to be told, plainly and before they upload, that their artwork goes out
 * exactly as drawn. Everything they are NOT giving up is listed beside it, because the honest pitch
 * is that the design stays theirs and the evening still works.</p>
 */
@Component({
  selector: 'app-bring-your-own',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, UiAlert, UiButton, UiCard, UiFormField, UiInput, UiText],
  templateUrl: './bring-your-own.component.html',
  styleUrl: './bring-your-own.component.scss',
})
export class BringYourOwnComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  /**
   * The event this design is for, when the visitor came from one. Set, the page stops asking for a
   * name — that event already has one — and the upload attaches instead of starting a second event.
   */
  protected readonly forEvent = signal<string | null>(
    this.route.snapshot.queryParamMap.get('forEvent'),
  );

  protected readonly title = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);

  /** Read back so somebody can see we took the file they meant, before they commit to it. */
  protected readonly preview = signal<string | null>(null);

  protected readonly ready = computed(
    () => (!!this.forEvent() || !!this.title().trim()) && !!this.file(),
  );

  /** What the picker offers. Images and clips are what design tools actually export; a zip is the
   *  richer case for anyone who has a real HTML bundle. */
  protected readonly accept = 'image/*,video/mp4,video/webm,.zip,application/zip';

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    input.value = '';
    if (!picked) return;

    this.file.set(picked);

    // A zip has nothing to show yet — the server is what opens it — so the thumbnail is only for
    // the case where the browser already holds something it can draw.
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.preview.set(
      picked.type.startsWith('image/') || picked.type.startsWith('video/')
        ? URL.createObjectURL(picked)
        : null,
    );
  }

  protected readonly isVideo = computed(() => this.file()?.type.startsWith('video/') ?? false);

  protected create(): void {
    const file = this.file();
    const title = this.title().trim();
    const existing = this.forEvent();
    if (!file || this.uploading() || (!existing && !title)) return;

    this.uploading.set(true);

    if (existing) {
      this.api.importDesign(existing, file).subscribe({
        next: () => {
          this.uploading.set(false);
          this.toast.success('Your design is in. Now add your guests.');
          void this.router.navigate(['/create', existing, 'guests']);
        },
        error: () => this.uploading.set(false),
      });
      return;
    }

    this.api.createFromOwnDesign(title, file).subscribe({
      next: ({ campaign }) => {
        this.uploading.set(false);
        this.toast.success('Your design is in. Now add your guests.');
        // Straight into the wizard at the guest step: an imported design declares no fields, so the
        // content step it would normally land on has nothing in it to fill.
        void this.router.navigate(['/create', campaign.campaignId, 'guests'], {
          queryParams: { resume: campaign.accessToken },
        });
      },
      error: () => this.uploading.set(false),
    });
  }
}

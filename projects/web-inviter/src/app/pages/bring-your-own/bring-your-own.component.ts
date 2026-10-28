import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router} from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

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
  imports: [BackLinkComponent, FormsModule, HugeiconsIconComponent, UiAlert, UiButton, UiCard, UiFormField, UiInput, UiText],
  templateUrl: './bring-your-own.component.html',
  styleUrl: './bring-your-own.component.scss',
})
export class BringYourOwnComponent {
  protected readonly appIcons = APP_ICONS;
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

  /**
   * The open guest list kind of invitation (chosen on the event's invitation step): the same upload,
   * after which the event is switched to one, so whoever has its link can reply with their name.
   */
  protected readonly openList = signal(this.route.snapshot.queryParamMap.get('list') === 'open');

  /** Uploading the design of a save the date: its "what you still get" is a calendar button, not replies and photos. */
  protected readonly saveTheDate = signal(false);

  constructor() {
    const existing = this.forEvent();
    if (existing) {
      this.api.getCampaignSummaryQuiet(existing).subscribe({
        next: (s) => this.saveTheDate.set(s.kind === 'saveTheDate'),
        error: () => {},
      });
    }
  }

  protected readonly title = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);

  /** Read back so somebody can see we took the file they meant, before they commit to it. */
  protected readonly preview = signal<string | null>(null);

  protected readonly ready = computed(
    () => (!!this.forEvent() || !!this.title().trim()) && !!this.file(),
  );

  /**
   * What the picker offers: one picture or one clip — what Canva, Figma and the rest actually
   * export. Zip bundles are deliberately not among them until the Figma integration can do
   * something with the layout inside one; the server refuses them too, so this is a courtesy rather
   * than the rule.
   */
  protected readonly accept = 'image/*,video/mp4,video/webm';

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    input.value = '';
    if (!picked) return;

    this.file.set(picked);

    // Everything we accept is something the browser can draw, so the preview is unconditional —
    // but the type check stays, because a picker can still hand back a file the accept list only
    // asked it not to offer.
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.preview.set(
      picked.type.startsWith('image/') || picked.type.startsWith('video/')
        ? URL.createObjectURL(picked)
        : null,
    );
  }

  protected readonly isVideo = computed(() => this.file()?.type.startsWith('video/') ?? false);

  /**
   * Switches the event to an open guest list once its design is in, when that is the kind chosen.
   * After the upload rather than before: the server only allows it for an uploaded design.
   *
   * <p>A failure here doesn't stop the flow. The design is already uploaded, so staying put would
   * only invite a second upload the server refuses; the error toast says what went wrong, and the
   * Share step has the same switch to turn it on.</p>
   */
  private thenOpenList(campaignId: string): Observable<void> {
    return this.openList()
      ? this.api.setOpenGuestList(campaignId, true).pipe(map(() => undefined), catchError(() => of(undefined)))
      : of(undefined);
  }

  private readonly doneMessage = computed(() =>
    this.openList()
      ? 'Your design is in. Add anyone you already know, or skip: guests can add themselves from the link.'
      : 'Your design is in. Now add your guests.',
  );

  protected create(): void {
    const file = this.file();
    const title = this.title().trim();
    const existing = this.forEvent();
    if (!file || this.uploading() || (!existing && !title)) return;

    this.uploading.set(true);

    if (existing) {
      this.api.importDesign(existing, file).pipe(switchMap(() => this.thenOpenList(existing))).subscribe({
        next: () => {
          this.uploading.set(false);
          this.toast.success(this.doneMessage());
          void this.router.navigate(['/create', existing, 'guests']);
        },
        error: () => this.uploading.set(false),
      });
      return;
    }

    this.api.createFromOwnDesign(title, file).pipe(
      switchMap((res) => {
        // The token is what lets the next call act on the event this one just made.
        this.api.storeToken(res.campaign.campaignId, res.campaign.accessToken);
        return this.thenOpenList(res.campaign.campaignId).pipe(map(() => res));
      }),
    ).subscribe({
      next: ({ campaign }) => {
        this.uploading.set(false);
        this.toast.success(this.doneMessage());
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

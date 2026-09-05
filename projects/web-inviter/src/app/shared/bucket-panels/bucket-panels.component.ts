import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { MediaBucket, MediaBucketPlan, MediaBucketQr } from '../utils/types/api.types';

/**
 * Everything you do TO a bucket: its size, its name and cover, the code people add with, and — for a
 * bucket that needs one — who may look at it.
 *
 * <p><b>One component, two homes.</b> A bucket attached to an event belongs on that event's
 * dashboard, because a host running a party should not have to go somewhere else to print the code
 * for it. A standalone bucket has its own page, because there is no event to put it on. Those are
 * the same controls, and keeping them in one place is what stops the two drifting into offering
 * different things.</p>
 *
 * <p><b>There is no who-can-see panel, deliberately.</b> A bucket belongs to an event, and that
 * event's guest list is who may look at it — one list, shared with the invitation. A second list
 * beside it would be configuration that decides nothing, which is how somebody adds a person and
 * then wonders why it changed nothing.</p>
 */
@Component({
  selector: 'app-bucket-panels',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, UiAlert, UiBadge, UiButton, UiCard, UiConfirmDialog, UiFormField,
    UiInput, UiModal, UiSwitch, UiText,
  ],
  templateUrl: './bucket-panels.component.html',
  styleUrl: './bucket-panels.component.scss',
})
export class BucketPanelsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly bucketId = input.required<string>();

  /** The bucket, given by whoever already loaded it, so the dashboard does not fetch it twice. */
  readonly initial = input<MediaBucket | null>(null);

  protected readonly bucket = signal<MediaBucket | null>(null);
  protected readonly plans = signal<MediaBucketPlan[]>([]);
  protected readonly codes = signal<MediaBucketQr[]>([]);

  /**
   * The code the dashboard keeps on show: the newest one that still works. This is the whole reason
   * codes are stored as rendered images — the token is hashed and cannot be read back, so without
   * the picture a host who printed a card last week would have nothing to reprint from.
   */
  protected readonly latestCode = computed(() => this.codes().find((c) => !c.revoked) ?? null);
  protected readonly retiredCodes = computed(() => this.codes().filter((c) => c.revoked));

  protected readonly editing = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly draftCover = signal('');
  protected readonly saving = signal(false);

  protected readonly sizing = signal(false);
  protected readonly resizing = signal(false);

  protected readonly makingCode = signal(false);
  protected readonly codeLabel = signal('');
  protected readonly codeAnonymous = signal(true);
  protected readonly creatingCode = signal(false);

  /** Held only while the page is open: the server returns the scannable link exactly once. */
  protected readonly freshLink = signal<string | null>(null);

  protected readonly revoking = signal<MediaBucketQr | null>(null);
  protected readonly confirmingRevoke = signal(false);


  ngOnInit(): void {
    const given = this.initial();
    if (given) this.adopt(given);
    else this.api.mediaBucket(this.bucketId()).subscribe({ next: (b) => this.adopt(b) });

    this.api.mediaBucketPlans(this.bucketId()).subscribe({
      next: (plans) => this.plans.set(plans),
      error: () => this.plans.set([]),
    });
    this.api.mediaBucketQrs(this.bucketId()).subscribe({
      next: (codes) => this.codes.set(codes),
      error: () => this.codes.set([]),
    });
  }

  private adopt(bucket: MediaBucket): void {
    this.bucket.set(bucket);
    this.draftTitle.set(bucket.title);
    this.draftCover.set(bucket.coverUrl ?? '');

  }

  /** How full it is, in the units people think in. */
  protected used(bucket: MediaBucket): string {
    const gb = bucket.usedBytes / 1024 ** 3;
    return gb >= 1
      ? `${gb.toFixed(1)} GB of ${bucket.gb} GB`
      : `${Math.round(bucket.usedBytes / 1024 ** 2)} MB of ${bucket.gb} GB`;
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .updateMediaBucket(this.bucketId(), { title: this.draftTitle(), coverUrl: this.draftCover() })
      .subscribe({
        next: (bucket) => {
          this.bucket.set(bucket);
          this.saving.set(false);
          this.editing.set(false);
          this.toast.success('Saved.');
        },
        error: () => this.saving.set(false),
      });
  }

  protected choose(plan: MediaBucketPlan): void {
    if (this.resizing() || plan.isCurrent) return;
    this.resizing.set(true);
    this.api.chooseMediaBucketTier(this.bucketId(), plan.tier).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.resizing.set(false);
        this.sizing.set(false);
        this.toast.success(`This bucket now holds ${plan.gb} GB.`);
      },
      error: () => this.resizing.set(false),
    });
  }

  protected createCode(): void {
    if (this.creatingCode()) return;
    this.creatingCode.set(true);
    this.api
      .createMediaBucketQr(this.bucketId(), {
        label: this.codeLabel(),
        allowAnonymous: this.codeAnonymous(),
      })
      .subscribe({
        next: (code) => {
          this.codes.update((all) => [code, ...all]);
          this.freshLink.set(code.url);
          this.creatingCode.set(false);
          this.makingCode.set(false);
          this.codeLabel.set('');
        },
        error: () => this.creatingCode.set(false),
      });
  }

  protected askToRevoke(code: MediaBucketQr): void {
    this.revoking.set(code);
    this.confirmingRevoke.set(true);
  }

  protected revoke(): void {
    const code = this.revoking();
    if (!code) return;
    this.api.revokeMediaBucketQr(this.bucketId(), code.id).subscribe({
      next: () => {
        this.codes.update((all) => all.map((c) => (c.id === code.id ? { ...c, revoked: true } : c)));
        if (this.latestCode()?.id !== code.id) this.freshLink.set(null);
        this.revoking.set(null);
        this.toast.success('That code no longer works.');
      },
      error: () => this.revoking.set(null),
    });
  }

  protected copy(link: string): void {
    void navigator.clipboard
      ?.writeText(link)
      .then(() => this.toast.success('Link copied.'))
      .catch(() => this.toast.danger('Could not copy that link.'));
  }
}

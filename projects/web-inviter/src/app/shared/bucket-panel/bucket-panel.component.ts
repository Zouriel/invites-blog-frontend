import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { MediaBucket, MediaBucketQr } from '../utils/types/api.types';
import { formatBytes } from '../utils/plans';

/**
 * One bucket, as the thing its owner administers — <b>a card per bucket, not one card per event</b>.
 *
 * <p>An event can hold several buckets once its owner subscribes: a ceremony and an after-party,
 * each with its own night and its own people. Everything that decides what a bucket IS therefore has
 * to be asked <i>of a particular one</i> — what it is called, the code that adds to it, how big it
 * is. A single "contribution code" panel on the dashboard could only ever mean the default bucket,
 * and silently meaning one of several is how a host prints the ceremony's code and puts it on the
 * after-party's tables.</p>
 *
 * <p>It lives on the DASHBOARD rather than beside the photographs. Handing out a code, naming a
 * bucket and buying it more room are all running the event — the same act as adding a guest or
 * sending an invitation — while the media tab is for looking at what came back. The only bucket
 * thing that belongs over there is how full it is, which is <code>app-bucket-size</code>.</p>
 *
 * <p><b>The size sits folded away.</b> It is the least-often-touched of the three and the only one
 * that costs money; open on arrival it would read as a thing being asked of the host every time they
 * came to print a code.</p>
 *
 * <p><b>One component, two homes.</b> A bucket attached to an event belongs on that event's
 * dashboard, because a host running a party should not have to go somewhere else to print the code
 * for it. A standalone bucket has its own page, because there is no event to put it on. Those are
 * the same controls, and keeping them in one place is what stops the two drifting into offering
 * different things.</p>
 *
 * <p><b>No cover and no who-can-see — deliberately.</b> Both belong to the event: it is the campaign
 * that has a cover and holds the guest list, and it shares them with its invitation. A bucket
 * carrying its own copies would be a second answer to questions that already have one. The name is
 * the exception, and only became one when an event could hold more than one bucket — "Night's
 * bucket" twice over names nothing.</p>
 */
@Component({
  selector: 'app-bucket-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, NgTemplateOutlet, FormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard,
    UiConfirmDialog, UiFormField, UiInput, UiModal, UiSwitch, UiText,
  ],
  templateUrl: './bucket-panel.component.html',
  styleUrl: './bucket-panel.component.scss',
})
export class BucketPanelComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly bucketId = input.required<string>();

  /** Without the card around it, for the bucket's settings modal. */
  readonly plain = input(false);

  /** The bucket, given by whoever already loaded it, so the dashboard does not fetch it twice. */
  readonly initial = input<MediaBucket | null>(null);

  /**
   * The bucket after this card changed it. Renaming and resizing happen HERE but are drawn
   * elsewhere too — the fullness bar over the media grid, the heading on a bucket's own page — and
   * a page that kept its own copy would go on showing the old name until it was reloaded.
   */
  readonly changed = output<MediaBucket>();

  /** Set only by this card's own edits; until then the one we were given is the truth. */
  private readonly edited = signal<MediaBucket | null>(null);
  protected readonly bucket = computed(() => this.edited() ?? this.initial());

  // ---------- the code ----------

  protected readonly codes = signal<MediaBucketQr[]>([]);

  /**
   * The code the card keeps on show: the newest one that still works. This is the whole reason
   * codes are stored as rendered images — the token is hashed and cannot be read back, so without
   * the picture a host who printed a card last week would have nothing to reprint from.
   */
  protected readonly latestCode = computed(() => this.codes().find((c) => !c.revoked) ?? null);
  protected readonly retiredCodes = computed(() => this.codes().filter((c) => c.revoked));

  protected readonly makingCode = signal(false);
  protected readonly codeLabel = signal('');
  protected readonly codeAnonymous = signal(true);
  protected readonly creatingCode = signal(false);

  /** Held only while the page is open: the server returns the scannable link exactly once. */
  protected readonly freshLink = signal<string | null>(null);

  protected readonly revoking = signal<MediaBucketQr | null>(null);
  protected readonly confirmingRevoke = signal(false);

  // ---------- the name ----------

  protected readonly renaming = signal(false);
  protected readonly savingName = signal(false);
  protected draftName = '';

  ngOnInit(): void {
    if (!this.initial()) {
      this.api.mediaBucket(this.bucketId()).subscribe({ next: (b) => this.edited.set(b) });
    }

    this.api.mediaBucketQrs(this.bucketId()).subscribe({
      next: (codes) => this.codes.set(codes),
      error: () => this.codes.set([]),
    });
  }

  /** Passes a change on to whoever is drawing this bucket somewhere else as well. */
  private adopt(bucket: MediaBucket): void {
    this.edited.set(bucket);
    this.changed.emit(bucket);
  }

  // ---------- the name ----------

  /**
   * Opens the rename box, or says why it cannot be used.
   *
   * <p>Checked here rather than by hiding the control. Somebody who cannot rename a bucket still
   * benefits from knowing the name is a thing that exists and what it would be for.</p>
   */
  protected startRename(bucket: MediaBucket): void {
    if (bucket.maxBuckets <= 1) {
      this.toast.info('Naming buckets comes with Premium or an event pass.');
      return;
    }
    this.draftName = bucket.name;
    this.renaming.set(true);
  }

  protected saveName(): void {
    if (this.savingName()) return;
    this.savingName.set(true);
    this.api.renameMediaBucket(this.bucketId(), this.draftName).subscribe({
      next: (updated) => {
        this.adopt(updated);
        this.savingName.set(false);
        this.renaming.set(false);
        this.toast.success(`Renamed to ${updated.name}.`);
      },
      error: () => this.savingName.set(false),
    });
  }

  /** How full the event is, against the space its plan gives it. */
  protected used(bucket: MediaBucket): string {
    return `${formatBytes(bucket.eventUsedBytes)} of ${formatBytes(bucket.capacityBytes)}`;
  }

  // ---------- a subscription's space, shared out ----------

  protected readonly resizing = signal(false);

  protected gb(bytes: number): string {
    return formatBytes(bytes);
  }

  protected currentGb(bucket: MediaBucket): number {
    return Math.round((bucket.capacityBytes / 1024 ** 3) * 10) / 10;
  }

  /** Can't go below what it already holds. */
  protected minGb(bucket: MediaBucket): number {
    return Math.ceil(bucket.usedBytes / 1024 ** 3);
  }

  /** Its own size plus whatever is left, on the event and on the account, whichever is less. */
  protected maxGb(bucket: MediaBucket): number {
    const accountLeft = (bucket.accountBytes ?? 0) - bucket.accountAllocatedBytes;
    const eventLeft = bucket.eventMaxBytes - bucket.eventAllocatedBytes;
    const max = Math.min(accountLeft, eventLeft) + bucket.capacityBytes;
    return Math.max(0, Math.floor((max / 1024 ** 3) * 10) / 10);
  }

  /** The account's space nobody has been given yet. */
  protected leftBytes(bucket: MediaBucket): number {
    return Math.max(0, (bucket.accountBytes ?? 0) - bucket.accountAllocatedBytes);
  }

  /** The sizes offered for a bucket: every step up to what an event can have on the plan. */
  protected sizeOptions(bucket: MediaBucket): number[] {
    const eventMax = bucket.eventMaxBytes / 1024 ** 3;
    const sizes = [0.5, 1, 2, 5, 10, 20, 30, 50].filter((g) => g <= eventMax);
    return [...new Set([...sizes, this.currentGb(bucket)])].sort((a, b) => a - b);
  }

  protected sizeLabel(gb: number): string {
    return gb < 1 ? `${Math.round(gb * 1000)} MB` : `${gb} GB`;
  }

  protected saveSize(bucket: MediaBucket, gb: number): void {
    if (this.resizing()) return;
    this.resizing.set(true);
    this.api.setBucketAllocation(bucket.id, gb).subscribe({
      next: (updated) => {
        this.adopt(updated);
        this.resizing.set(false);
        this.toast.success(`${updated.name} now holds ${formatBytes(updated.capacityBytes)}.`);
      },
      error: () => this.resizing.set(false),
    });
  }

  /** The sizes an event can have, and which plans give them. */
  protected readonly sizes = [
    { label: '500 MB', plans: 'Free', kinds: ['Free'] },
    { label: '2 GB', plans: 'Basic', kinds: ['Basic'] },
    { label: '50 GB', plans: 'Event pass or Premium', kinds: ['EventPass', 'Premium'] },
  ];


  // ---------- the code ----------

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

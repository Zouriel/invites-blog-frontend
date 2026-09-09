import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { MediaBucket, MediaBucketPlan, MediaBucketQr } from '../utils/types/api.types';

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
    DatePipe, FormsModule, UiAccordion, UiAccordionItem, UiAlert, UiBadge, UiButton, UiCard,
    UiConfirmDialog, UiFormField, UiInput, UiModal, UiSpinner, UiSwitch, UiText,
  ],
  templateUrl: './bucket-panel.component.html',
  styleUrl: './bucket-panel.component.scss',
})
export class BucketPanelComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly session = inject(SessionStore);

  readonly bucketId = input.required<string>();

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

  // ---------- the size ----------

  protected readonly plans = signal<MediaBucketPlan[]>([]);
  protected readonly resizing = signal(false);

  /**
   * The fold, watched rather than eagerly loaded. A dashboard draws one of these per bucket, so
   * asking every card for the price list on arrival is several requests for a panel most visits
   * never open.
   */
  private readonly sizeSection = viewChild(UiAccordionItem);
  private plansAsked = false;

  constructor() {
    effect(() => {
      if (this.sizeSection()?.open()) this.loadPlans();
    });
  }

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
    if (!this.session.isSubscriber()) {
      this.toast.info('Naming your buckets is part of a subscription.');
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

  // ---------- the size ----------

  private loadPlans(): void {
    if (this.plansAsked) return;
    this.plansAsked = true;
    this.api.mediaBucketPlans(this.bucketId()).subscribe({
      next: (plans) => this.plans.set(plans),
      error: () => this.plans.set([]),
    });
  }

  /** How full it is, in the units people think in — megabytes until there is a gigabyte in it. */
  protected used(bucket: MediaBucket): string {
    const gb = bucket.usedBytes / 1024 ** 3;
    return gb >= 1
      ? `${gb.toFixed(1)} GB of ${bucket.gb} GB`
      : `${Math.round(bucket.usedBytes / 1024 ** 2)} MB of ${bucket.gb} GB`;
  }

  protected choose(plan: MediaBucketPlan): void {
    if (this.resizing() || plan.isCurrent) return;
    this.resizing.set(true);
    this.api.chooseMediaBucketTier(this.bucketId(), plan.tier).subscribe({
      next: (bucket) => {
        this.adopt(bucket);
        // The list carries an isCurrent flag, and leaving it pointing at the old size would draw
        // two current sizes until the page was reloaded.
        this.plans.update((all) => all.map((p) => ({ ...p, isCurrent: p.tier === plan.tier })));
        this.resizing.set(false);
        this.toast.success(`This bucket now holds ${plan.gb} GB.`);
      },
      error: () => this.resizing.set(false),
    });
  }

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

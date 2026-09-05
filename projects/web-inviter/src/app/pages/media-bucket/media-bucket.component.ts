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
import { RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { PhotoBoxComponent } from '../../shared/photo-box/photo-box.component';
import {
  MediaBucket,
  MediaBucketMember,
  MediaBucketPlan,
  MediaBucketQr,
} from '../../shared/utils/types/api.types';

/**
 * One media bucket: what it is called, what it looks like, how big it is, and who can put things in
 * it.
 *
 * <p>This page exists because a bucket is a product rather than a tab inside an event. A bucket
 * bought for a trip has no invitation behind it and no dashboard to live on, and the only place its
 * owner could ever open it is here.</p>
 */
@Component({
  selector: 'app-media-bucket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiConfirmDialog,
    UiFormField, UiInput, UiModal, UiSpinner, UiSwitch, UiText, PhotoBoxComponent,
  ],
  templateUrl: './media-bucket.component.html',
  styleUrl: './media-bucket.component.scss',
})
export class MediaBucketComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly bucketId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly bucket = signal<MediaBucket | null>(null);
  protected readonly plans = signal<MediaBucketPlan[]>([]);
  protected readonly codes = signal<MediaBucketQr[]>([]);

  /**
   * The code the dashboard keeps on show: the newest one that still works.
   *
   * <p>This is the whole reason codes are stored as rendered images. The token behind a code is
   * hashed and cannot be read back, so without the picture a host who printed a card last week would
   * have nothing to reprint from.</p>
   */
  protected readonly latestCode = computed(() => this.codes().find((c) => !c.revoked) ?? null);

  /** Codes that were made and then turned off. Kept visible so revoking is legible rather than silent. */
  protected readonly retiredCodes = computed(() => this.codes().filter((c) => c.revoked));

  // --- renaming and re-covering ---------------------------------------------------------------
  protected readonly editing = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly draftCover = signal('');
  protected readonly saving = signal(false);

  // --- choosing a size ------------------------------------------------------------------------
  protected readonly sizing = signal(false);
  protected readonly resizing = signal(false);

  // --- making a code --------------------------------------------------------------------------
  protected readonly makingCode = signal(false);
  protected readonly codeLabel = signal('');
  /**
   * Ticked by default. The common code is the one printed on the tables at a party, where anybody
   * who turns up should be able to add — a default of "verify first" would quietly make the rare
   * case the normal one, and the cards are already printed by the time anyone notices.
   */
  protected readonly codeAnonymous = signal(true);
  protected readonly creatingCode = signal(false);

  /**
   * The scannable link, held only for as long as the page is open after making a code. The server
   * returns it exactly once — see MediaBucketQr — so this is deliberately not refetched or stored.
   */
  protected readonly freshLink = signal<string | null>(null);

  protected readonly revoking = signal<MediaBucketQr | null>(null);
  protected readonly confirmingRevoke = signal(false);

  // --- who may look ---------------------------------------------------------------------------
  protected readonly members = signal<MediaBucketMember[]>([]);
  protected readonly addingMember = signal(false);
  protected readonly memberContact = signal('');
  protected readonly memberName = signal('');
  protected readonly savingMember = signal(false);

  // ngOnInit, not the constructor: an input has no value until after construction, so this would
  // otherwise load the bucket with an empty id.
  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.mediaBucket(this.bucketId()).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.draftTitle.set(bucket.title);
        this.draftCover.set(bucket.coverUrl ?? '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.mediaBucketPlans(this.bucketId()).subscribe({
      next: (plans) => this.plans.set(plans),
      error: () => this.plans.set([]),
    });
    this.api.mediaBucketQrs(this.bucketId()).subscribe({
      next: (codes) => this.codes.set(codes),
      error: () => this.codes.set([]),
    });
    this.api.mediaBucketMembers(this.bucketId()).subscribe({
      next: (list) => this.members.set(list),
      // A member of somebody else's bucket may look at it but not read its list, and that 403 is
      // the expected answer rather than a failure worth a banner.
      error: () => this.members.set([]),
    });
  }

  protected addMember(): void {
    const contact = this.memberContact().trim();
    if (!contact || this.savingMember()) return;

    this.savingMember.set(true);
    this.api
      .addMediaBucketMember(this.bucketId(), { contact, name: this.memberName().trim() || null })
      .subscribe({
        next: (member) => {
          this.members.update((all) =>
            all.some((m) => m.id === member.id) ? all : [...all, member],
          );
          this.memberContact.set('');
          this.memberName.set('');
          this.savingMember.set(false);
          this.addingMember.set(false);
          this.toast.success(`${member.name || member.contact} can see this bucket.`);
        },
        error: () => this.savingMember.set(false),
      });
  }

  protected removeMember(member: MediaBucketMember): void {
    this.api.removeMediaBucketMember(this.bucketId(), member.id).subscribe({
      next: () => {
        this.members.update((all) => all.filter((m) => m.id !== member.id));
        this.toast.success('Removed.');
      },
    });
  }

  /** How full it is, in the units people think in — see the same rule on the Events list. */
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
      .updateMediaBucket(this.bucketId(), {
        title: this.draftTitle(),
        coverUrl: this.draftCover(),
      })
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
        this.codes.update((all) =>
          all.map((c) => (c.id === code.id ? { ...c, revoked: true } : c)),
        );
        // The link on screen belongs to a code that no longer works.
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

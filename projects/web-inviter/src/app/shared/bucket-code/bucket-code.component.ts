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
import { MediaBucket, MediaBucketQr } from '../utils/types/api.types';

/**
 * The code a host prints and puts on the tables, and the ones they have turned off.
 *
 * <p>It lives on the DASHBOARD rather than beside the photographs. Handing out a code is running the
 * event — the same act as adding a guest or sending an invitation — while the media tab is for
 * looking at what came back. The size bar is the only bucket thing that belongs over there, because
 * "is there room left" is a question you ask while looking at the pictures.</p>
 *
 * <p><b>One component, two homes.</b> A bucket attached to an event belongs on that event's
 * dashboard, because a host running a party should not have to go somewhere else to print the code
 * for it. A standalone bucket has its own page, because there is no event to put it on. Those are
 * the same controls, and keeping them in one place is what stops the two drifting into offering
 * different things.</p>
 *
 * <p><b>No name, no cover, no who-can-see — deliberately.</b> All three belong to the event: it is
 * the campaign that is named, has a cover, and holds the guest list, and it shares them with its
 * invitation. A bucket carrying its own copies would be a second answer to questions that already
 * have one, and the two would drift the moment somebody renamed either. Those controls live on the
 * event's dashboard, which is where a host is already standing.</p>
 */
@Component({
  selector: 'app-bucket-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, UiAlert, UiBadge, UiButton, UiCard, UiConfirmDialog, UiFormField,
    UiInput, UiModal, UiSwitch, UiText,
  ],
  templateUrl: './bucket-code.component.html',
  styleUrl: './bucket-code.component.scss',
})
export class BucketCodeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly bucketId = input.required<string>();

  /** The bucket, given by whoever already loaded it, so the dashboard does not fetch it twice. */
  readonly initial = input<MediaBucket | null>(null);

  protected readonly bucket = signal<MediaBucket | null>(null);
  protected readonly codes = signal<MediaBucketQr[]>([]);

  /**
   * The code the dashboard keeps on show: the newest one that still works. This is the whole reason
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


  ngOnInit(): void {
    const given = this.initial();
    if (given) this.adopt(given);
    else this.api.mediaBucket(this.bucketId()).subscribe({ next: (b) => this.adopt(b) });

    this.api.mediaBucketQrs(this.bucketId()).subscribe({
      next: (codes) => this.codes.set(codes),
      error: () => this.codes.set([]),
    });
  }

  private adopt(bucket: MediaBucket): void {
    this.bucket.set(bucket);
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

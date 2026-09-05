import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput, UiOtpInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { concat, defer, Observable, of, switchMap, toArray } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { posterFrameFor } from '../../shared/utils/poster-frame';
import { BucketScan } from '../../shared/utils/types/api.types';

/**
 * Where a scanned QR code lands: add your photos to somebody's bucket.
 *
 * <p><b>Built for someone standing at a party.</b> They are on a phone, probably on bad wifi, they
 * have never seen this product, and they are not going to make an account. So the page is one
 * column, one question, and then a picker — and it never asks for anything it does not need.</p>
 *
 * <p>Two ways in, decided by whoever printed the code. An anonymous code asks only what to call
 * them. A verified code sends a one-time code to an email or phone first. Either way what comes back
 * is a ticket that covers the rest of the evening, so nobody verifies twenty times for twenty
 * photographs.</p>
 *
 * <p>What this page deliberately cannot do is show the bucket. A contributor adds and that is all —
 * anyone who photographed the card on the table would otherwise be able to read a stranger's
 * evening.</p>
 */
@Component({
  selector: 'app-bucket-contribute',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, UiAlert, UiButton, UiCard, UiFormField, UiInput, UiOtpInput, UiSpinner,
    UiText,
  ],
  templateUrl: './bucket-contribute.component.html',
  styleUrl: './bucket-contribute.component.scss',
})
export class BucketContributeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  /** The token out of the printed URL. The whole of a contributor's authorization. */
  readonly token = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly scan = signal<BucketScan | null>(null);
  protected readonly failed = signal(false);

  /** Held once admitted. Not persisted: a shared phone should not stay admitted to a stranger's bucket. */
  protected readonly ticket = signal<string | null>(null);
  protected readonly displayName = signal('');

  protected readonly name = signal('');
  protected readonly contact = signal('');
  protected readonly challengeId = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly uploading = signal(false);
  protected readonly addedCount = signal(0);

  /**
   * Whether the night hasn't arrived yet, as opposed to being over. Both read as "closed" to the
   * server, and they are opposite things to say to somebody holding a phone.
   */
  protected closedBefore(scan: BucketScan): boolean {
    return new Date(scan.eventDate).getTime() > Date.now();
  }

  /** Whether the one-time code step is showing. */
  protected readonly awaitingCode = computed(() => !!this.challengeId());

  /** Same ceiling the server enforces, checked here so an oversized clip fails before the upload. */
  private static readonly MaxVideoBytes = 256 * 1024 * 1024;

  // ngOnInit, not the constructor: an input has no value until after construction, so reading the
  // token there would scan an empty string.
  ngOnInit(): void {
    this.api.scanBucketCode(this.token()).subscribe({
      next: (scan) => {
        this.scan.set(scan);
        this.loading.set(false);
      },
      error: () => {
        // A bad token, a revoked one and a deleted bucket all look the same here, exactly as the
        // server intends — whether a code is real is what somebody guessing wants to know.
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  // --- getting in ------------------------------------------------------------------------------

  protected join(): void {
    const name = this.name().trim();
    if (!name || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.api.joinBucket(this.token(), name).subscribe({
      next: (admission) => {
        this.admit(admission.ticket, admission.displayName);
        this.busy.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message);
        this.busy.set(false);
      },
    });
  }

  protected sendCode(): void {
    const contact = this.contact().trim();
    if (!contact || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    // Which channel from the shape of what they typed, rather than making somebody at a party pick
    // between "email" and "SMS" before they can do anything.
    const isEmail = contact.includes('@');
    this.api
      .requestBucketCode(this.token(), {
        channel: isEmail ? 'Email' : 'Sms',
        email: isEmail ? contact : null,
        phone: isEmail ? null : contact,
      })
      .subscribe({
        next: (challenge) => {
          this.challengeId.set(challenge.challengeId);
          this.busy.set(false);
        },
        error: (e: Error) => {
          this.error.set(e.message);
          this.busy.set(false);
        },
      });
  }

  protected verify(): void {
    if (this.code().length !== 6 || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.api
      .verifyBucketCode(this.token(), {
        challengeId: this.challengeId(),
        code: this.code(),
        displayName: this.name().trim() || null,
      })
      .subscribe({
        next: (admission) => {
          this.admit(admission.ticket, admission.displayName);
          this.busy.set(false);
        },
        error: (e: Error) => {
          this.error.set(e.message);
          this.busy.set(false);
        },
      });
  }

  private admit(ticket: string, name: string): void {
    this.ticket.set(ticket);
    this.displayName.set(name);
    this.challengeId.set('');
    this.code.set('');
  }

  /** Codes get pasted with the sentence around them — keep the digits, cap at six. */
  protected setCode(raw: string): void {
    this.code.set((raw ?? '').replace(/\D/g, '').slice(0, 6));
  }

  // --- adding ----------------------------------------------------------------------------------

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';

    const ticket = this.ticket();
    if (!picked.length || !ticket) return;

    const oversized = picked.filter(
      (f) => f.type.startsWith('video/') && f.size > BucketContributeComponent.MaxVideoBytes,
    );
    if (oversized.length) {
      this.toast.danger(
        oversized.length === 1
          ? `“${oversized[0].name}” is too long to upload.`
          : `${oversized.length} clips are too long to upload.`,
      );
    }
    const sendable = picked.filter((f) => !oversized.includes(f));
    if (!sendable.length) return;

    // One request per item, sequentially. A contributor is on a phone at an event: several large
    // uploads in flight at once is how this stalls, and one at a time means a failure loses one file
    // rather than the whole selection.
    const uploads = sendable.map((f) =>
      defer(async () => (f.type.startsWith('video/') ? await posterFrameFor(f) : null)).pipe(
        switchMap((poster) => {
          if (f.type.startsWith('video/') && !poster) {
            this.toast.danger(`We couldn't read “${f.name}”.`);
            return of(null);
          }
          return this.api.contributeToBucket(this.token(), ticket, f, poster).pipe(
            // A refusal has already been surfaced by the API service; keep the queue going.
            switchMap((r) => of(r as unknown)),
          ) as Observable<unknown>;
        }),
      ),
    );

    this.uploading.set(true);
    concat(...uploads)
      .pipe(toArray())
      .subscribe({
        next: (results) => {
          const added = results.filter(Boolean).length;
          this.addedCount.update((n) => n + added);
          this.uploading.set(false);
          if (added) {
            this.toast.success(added === 1 ? 'Added. Thank you!' : `${added} added. Thank you!`);
          }
        },
        error: () => this.uploading.set(false),
      });
  }
}

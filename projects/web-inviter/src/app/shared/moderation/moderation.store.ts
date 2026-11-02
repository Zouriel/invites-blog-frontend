import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { ReportKind, ReportReason, ReportResult } from '../utils/types/api.types';

/** The six reasons, in the words the report dialog uses. The values are the server's. */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'abusive', label: 'Abusive or bullying' },
  { value: 'hateful', label: 'Hateful' },
  { value: 'sexual', label: 'Sexual or nudity' },
  { value: 'violent', label: 'Violent or threatening' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export function reasonLabel(reason: string): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** Something about to be reported, with what the dialog needs to name it. */
export type ReportTarget = {
  kind: ReportKind;
  /** The campaign id of a post, the comment id, the album item id, or the account id of a person. */
  id: string;
  /** How the dialog names it: "post", "comment", "photo", "video", or the person's name. */
  noun: string;
  /** Whose it is, when known, so the dialog can offer to block them too. */
  owner?: BlockTarget | null;
};

/** Somebody about to be blocked. */
export type BlockTarget = { userId: string; name: string };

/**
 * Report and block (App Store guideline 1.2, Google Play's UGC policy), shared by every screen that
 * shows something someone else put here: feed posts, comments, album items and people.
 *
 * <p>The screens only ASK (`askReport`, `askBlock`); one set of dialogs in the app shell answers, so
 * the wording and the confirm step are the same everywhere. What the reader stops seeing is kept here
 * too: a report the server says is hidden, and anyone blocked in this session, are filtered out of
 * whatever is on screen at once. The server filters the same things on every later load.</p>
 */
@Injectable({ providedIn: 'root' })
export class ModerationStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(UiToastService);

  /** The signed-in account's id, or null when nobody is signed in. */
  readonly myId = computed(() => (this.session.isSignedIn() ? (this.session.account()?.id ?? null) : null));
  /** Reporting needs an account; without one the screens link to the contact page instead. */
  readonly canReport = computed(() => !!this.myId());

  private readonly hiddenKeys = signal<ReadonlySet<string>>(new Set());
  private readonly blockedIds = signal<ReadonlySet<string>>(new Set());

  /** What the report dialog is open on. */
  readonly reporting = signal<ReportTarget | null>(null);
  /** Who the block confirm is open on. */
  readonly blocking = signal<BlockTarget | null>(null);

  /** Hidden for this reader since the page loaded: reported (and hidden by the server). */
  isHidden(kind: ReportKind, id: string): boolean {
    return this.hiddenKeys().has(`${kind}:${id}`);
  }

  /** Blocked in this session. */
  isBlocked(userId: string | null | undefined): boolean {
    return !!userId && this.blockedIds().has(userId);
  }

  /** Signed in, and the account is known and not the reader's own. */
  isOthers(userId: string | null | undefined): boolean {
    const me = this.myId();
    return !!me && !!userId && userId !== me;
  }

  askReport(target: ReportTarget): void {
    this.blocking.set(null);
    this.reporting.set(target);
  }

  askBlock(target: BlockTarget): void {
    this.reporting.set(null);
    this.blocking.set(target);
  }

  /** Sends the report. When the server hides the item for the reporter, it leaves the screen at once. */
  async report(target: ReportTarget, reason: ReportReason, note: string): Promise<ReportResult> {
    const result = await firstValueFrom(this.api.reportContent(target.kind, target.id, reason, note.trim() || null));
    if (result?.hidden) {
      this.hiddenKeys.update((set) => new Set(set).add(`${target.kind}:${target.id}`));
    }
    return result;
  }

  /** Blocks someone. Their posts, comments and album items leave the screen at once. */
  async block(target: BlockTarget): Promise<void> {
    await firstValueFrom(this.api.blockPerson(target.userId));
    this.blockedIds.update((set) => new Set(set).add(target.userId));
    this.toast.success(`${target.name} is blocked. You won't see their posts, comments or photos.`);
  }

  async unblock(userId: string): Promise<void> {
    await firstValueFrom(this.api.unblockPerson(userId));
    this.blockedIds.update((set) => {
      const next = new Set(set);
      next.delete(userId);
      return next;
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFileUpload } from '@zouriel/ui/form';
import { UiProgressBar } from '@zouriel/ui/progress';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { APP_ICONS } from '../icons/app-icons';
import { Portfolio, PORTFOLIO_UPLOAD_ACCEPT, PORTFOLIO_UPLOAD_MAX_BYTES } from './portfolio.types';

/** How many pictures go up at once: each has its own progress, and the server decodes two at a time. */
export const UPLOAD_WORKERS = 3;

/** Refusals that the same file will get again: no Retry for those. */
const FINAL_CODES = new Set(['not_an_image', 'too_big', 'too_many_pixels', 'photo_limit', 'wrong_kind', 'studio_required']);

export type UploadRow = {
  key: number;
  file: File;
  status: 'waiting' | 'sending' | 'done' | 'failed';
  /** Share sent, 0-100 (the progress bar's scale). */
  percent: number;
  error: string | null;
  canRetry: boolean;
};

/**
 * The upload box of an uploads collection (past work, straight from the device): pick or drop several pictures,
 * each goes up on its own with its progress, a failed one can be tried again. Shows how many of the 500 are used.
 * The server reads each file's type from its bytes, so the box only filters the dialog.
 */
@Component({
  selector: 'app-portfolio-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiButton, UiFileUpload, UiProgressBar, UiText],
  template: `
    <ui-file-upload
      [multiple]="true"
      [accept]="accept"
      acceptLabel="JPEG, PNG, WebP or HEIC, up to 30 MB each"
      label="Choose photos"
      [hint]="touch ? '' : 'or drag them here'"
      [showFiles]="false"
      [disabled]="left() <= 0"
      (filesSelected)="add($event)"
      (rejected)="refused($event)"
    />
    <ui-text variant="caption" class="count" data-testid="upload-count">
      {{ used() }} of {{ limit() }} photos used.
      @if (left() > 0) { {{ left() }} left. } @else { Your portfolio is full: remove some to add more. }
    </ui-text>

    @if (rows().length) {
      <div class="summary">
        <ui-text variant="caption">{{ summary() }}</ui-text>
        <div class="summary__actions">
          @if (retryable().length > 1) {
            <ui-button variant="secondary" size="sm" (click)="retryAll()">
              <hugeicons-icon [icon]="icons.retry" [size]="16" [strokeWidth]="1.8" /> Try all again
            </ui-button>
          }
          @if (!active()) {
            <ui-button variant="ghost" size="sm" (click)="clear()">Clear list</ui-button>
          }
        </div>
      </div>
      <ul class="rows" aria-label="Uploads">
        @for (r of rows(); track r.key) {
          <li class="row" [class.row--failed]="r.status === 'failed'">
            <span class="row__icon" aria-hidden="true">
              @switch (r.status) {
                @case ('done') { <hugeicons-icon class="ok" [icon]="icons.done" [size]="18" [strokeWidth]="2" /> }
                @case ('failed') { <hugeicons-icon class="bad" [icon]="icons.failed" [size]="18" [strokeWidth]="1.8" /> }
                @default { <hugeicons-icon [icon]="icons.photo" [size]="18" [strokeWidth]="1.8" /> }
              }
            </span>
            <span class="row__main">
              <span class="row__name" [attr.title]="r.file.name">{{ r.file.name }}</span>
              @if (r.status === 'sending' || r.status === 'waiting') {
                <ui-progress-bar [value]="r.status === 'waiting' ? 0 : r.percent" [label]="'Uploading ' + r.file.name" />
              } @else if (r.status === 'failed') {
                <span class="row__error">{{ r.error }}</span>
              } @else {
                <span class="row__done">Added</span>
              }
            </span>
            @if (r.status === 'failed' && r.canRetry) {
              <ui-button variant="ghost" size="sm" (click)="retry(r)">
                <hugeicons-icon [icon]="icons.retry" [size]="16" [strokeWidth]="1.8" /> Try again
              </ui-button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .count { color: var(--ui-color-text-muted); }
    .summary { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); flex-wrap: wrap; margin-top: var(--ui-space-2); }
    .summary__actions { display: flex; gap: var(--ui-space-2); }
    .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--ui-space-1); max-height: 360px; overflow: auto; }
    .row { display: flex; align-items: center; gap: var(--ui-space-3); min-height: 44px; padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); border-radius: var(--ui-radius-sm); }
    .row__icon { flex: none; display: inline-flex; color: var(--ui-color-text-muted); }
    .row__icon .ok { color: var(--ui-color-success); }
    .row__icon .bad { color: var(--ui-color-danger); }
    .row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .row__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ui-font-size-sm); }
    .row__error { color: var(--ui-color-danger); font-size: var(--ui-font-size-sm); }
    .row__done { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class PortfolioUploaderComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly icons = APP_ICONS;
  protected readonly accept = PORTFOLIO_UPLOAD_ACCEPT;
  /** A phone has nothing to drag from, so it isn't told to. */
  protected readonly touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  readonly collectionId = input.required<string>();
  readonly portfolio = input.required<Portfolio>();
  /** After every picture that went in: the whole portfolio, as the server now has it. */
  readonly changed = output<Portfolio>();

  protected readonly rows = signal<UploadRow[]>([]);
  private nextKey = 0;
  private readonly running = new Map<number, Subscription>();

  protected readonly limit = computed(() => this.portfolio().photoLimit);
  protected readonly used = computed(() => this.portfolio().photoCount);
  /** Room left once what is already waiting or going up lands. */
  protected readonly left = computed(() => {
    const pending = this.rows().filter((r) => r.status === 'waiting' || r.status === 'sending').length;
    return Math.max(0, this.limit() - this.used() - pending);
  });
  protected readonly active = computed(() => this.rows().some((r) => r.status === 'waiting' || r.status === 'sending'));
  protected readonly retryable = computed(() => this.rows().filter((r) => r.status === 'failed' && r.canRetry));
  protected readonly summary = computed(() => {
    const rows = this.rows();
    const done = rows.filter((r) => r.status === 'done').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const going = rows.length - done - failed;
    const parts = [`${done} of ${rows.length} added`];
    if (going) parts.push(`${going} going up`);
    if (failed) parts.push(`${failed} didn't go`);
    return parts.join(', ') + '.';
  });

  protected add(files: File[]): void {
    let room = this.left();
    const fresh: UploadRow[] = files.map((file) => {
      const row: UploadRow = { key: this.nextKey++, file, status: 'waiting', percent: 0, error: null, canRetry: true };
      if (file.size > PORTFOLIO_UPLOAD_MAX_BYTES) return { ...row, status: 'failed', error: 'Too big: use a picture under 30 MB.', canRetry: false };
      if (room <= 0) return { ...row, status: 'failed', error: 'Your portfolio is full (500 photos).', canRetry: false };
      room--;
      return row;
    });
    this.rows.update((list) => [...list, ...fresh]);
    this.pump();
  }

  protected refused(files: File[]): void {
    const n = files.length;
    this.toast.danger(`${n === 1 ? "That file isn't" : `${n} files aren't`} a photo we can use. Use JPEG, PNG, WebP or HEIC.`);
  }

  protected retry(row: UploadRow): void {
    this.patch(row.key, { status: 'waiting', percent: 0, error: null });
    this.pump();
  }

  protected retryAll(): void {
    for (const r of this.retryable()) this.patch(r.key, { status: 'waiting', percent: 0, error: null });
    this.pump();
  }

  protected clear(): void {
    this.rows.set([]);
  }

  /** Starts waiting rows while fewer than {@link UPLOAD_WORKERS} are going up. */
  private pump(): void {
    for (const row of this.rows()) {
      if (this.running.size >= UPLOAD_WORKERS) return;
      if (row.status === 'waiting' && !this.running.has(row.key)) this.send(row);
    }
  }

  private send(row: UploadRow): void {
    this.patch(row.key, { status: 'sending', percent: 0 });
    const sub = this.api.uploadPortfolioPhoto(this.collectionId(), row.file).subscribe({
      next: (e) => {
        if (e.kind === 'progress') this.patch(row.key, { percent: Math.round(e.share * 100) });
        else {
          this.patch(row.key, { status: 'done', percent: 100 });
          this.changed.emit(e.result.portfolio);
        }
      },
      error: (err: Error & { code?: string | null }) => {
        this.running.delete(row.key);
        this.patch(row.key, { status: 'failed', error: err.message, canRetry: !FINAL_CODES.has(err.code ?? '') });
        this.pump();
      },
      complete: () => {
        this.running.delete(row.key);
        this.pump();
      },
    });
    // A synchronous answer (tests) may already have finished it.
    if (!sub.closed) this.running.set(row.key, sub);
  }

  private patch(key: number, change: Partial<UploadRow>): void {
    this.rows.update((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  ngOnDestroy(): void {
    for (const s of this.running.values()) s.unsubscribe();
  }
}

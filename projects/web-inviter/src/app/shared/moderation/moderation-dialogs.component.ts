import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal } from '@zouriel/ui/dialog';
import { UiFormField, UiRadioGroup, UiTextarea } from '@zouriel/ui/form';
import { ReportReason, ReportResult } from '../utils/types/api.types';
import { BlockTarget, ModerationStore, REPORT_REASONS } from './moderation.store';

/**
 * The report dialog and the block confirm, mounted once in the app shell and opened by
 * {@link ModerationStore.askReport} / {@link ModerationStore.askBlock} from any screen.
 *
 * <p>A centred modal on every screen size, like "Report this template": the site has no bottom-sheet
 * dialogs outside the designer, and a short radio list fits a phone as it is.</p>
 */
@Component({
  selector: 'app-moderation-dialogs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiConfirmDialog, UiModal, UiFormField, UiRadioGroup, UiTextarea],
  template: `
    <ui-modal [open]="!!store.reporting()" (openChange)="!$event && closeReport()" [title]="title()" size="sm">
      <div class="body">
        @if (result(); as done) {
          <p class="said">{{ done.message }}</p>
          <div class="actions">
            @if (offerBlock(); as owner) {
              <ui-button variant="outline" (click)="blockFromReport(owner)">Block {{ owner.name }}</ui-button>
            }
            <ui-button variant="primary" (click)="closeReport()">Done</ui-button>
          </div>
        } @else {
          <ui-radio-group [(ngModel)]="reason" name="report-reason" [options]="reasons" label="What's wrong with it?" />
          <ui-form-field label="Anything else we should know? (optional)">
            <ui-textarea [(ngModel)]="note" [rows]="3" [maxlength]="1000" placeholder="Tell us what you saw" />
          </ui-form-field>
          <div class="actions">
            @if (offerBlock(); as owner) {
              <!-- Blocking without reporting: where Block has no room of its own (the photo viewer). -->
              <ui-button class="block" variant="ghost" (click)="blockFromReport(owner)">Block {{ owner.name }}</ui-button>
            }
            <ui-button variant="ghost" (click)="closeReport()">Cancel</ui-button>
            <ui-button variant="primary" [loading]="sending()" [disabled]="!reason" (click)="send()">Send</ui-button>
          </div>
        }
      </div>
    </ui-modal>

    <ui-confirm-dialog
      [open]="!!store.blocking()"
      (openChange)="!$event && store.blocking.set(null)"
      [title]="'Block ' + (store.blocking()?.name ?? '') + '?'"
      message="You won't see their posts, comments or photos, and they won't be told."
      confirmLabel="Block"
      [destructive]="true"
      (confirm)="confirmBlock()"
    />
  `,
  styles: `
    .body { display: grid; gap: 14px; }
    .said { margin: 0; }
    .actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
    .actions .block { margin-right: auto; }
  `,
})
export class ModerationDialogsComponent {
  protected readonly store = inject(ModerationStore);

  protected readonly reasons = REPORT_REASONS;
  protected reason: ReportReason | '' = '';
  protected note = '';
  protected readonly sending = signal(false);
  protected readonly result = signal<ReportResult | null>(null);

  protected readonly title = computed(() => {
    const target = this.store.reporting();
    if (!target) return '';
    return target.kind === 'user' ? `Report ${target.noun}` : `Report this ${target.noun}`;
  });

  /** After a report, the person behind it can be blocked too, unless they already are. */
  protected readonly offerBlock = computed(() => {
    const owner = this.store.reporting()?.owner;
    return owner && !this.store.isBlocked(owner.userId) ? owner : null;
  });

  constructor() {
    // A fresh form each time the dialog opens on something.
    effect(() => {
      this.store.reporting();
      untracked(() => {
        this.reason = '';
        this.note = '';
        this.result.set(null);
        this.sending.set(false);
      });
    });
  }

  protected closeReport(): void {
    this.store.reporting.set(null);
  }

  protected async send(): Promise<void> {
    const target = this.store.reporting();
    if (!target || !this.reason || this.sending()) return;
    this.sending.set(true);
    try {
      this.result.set(await this.store.report(target, this.reason, this.note));
    } catch {
      // The API toast says why (yours, gone, too many reports); the form stays so they can try again.
    } finally {
      this.sending.set(false);
    }
  }

  protected blockFromReport(owner: BlockTarget): void {
    this.store.askBlock(owner);
  }

  protected async confirmBlock(): Promise<void> {
    // Read before the confirm dialog closes itself, which clears the target.
    const target = this.store.blocking();
    if (!target) return;
    try {
      await this.store.block(target);
    } catch {
      // The API toast says why.
    }
  }
}

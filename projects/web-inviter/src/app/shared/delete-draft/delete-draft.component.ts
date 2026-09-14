import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';

/**
 * Deletes an event that was never finished. Shown only while the event is still a draft: a sent
 * invitation is cancelled from its dashboard instead, so guests see what happened.
 */
@Component({
  selector: 'app-delete-draft',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiConfirmDialog],
  template: `
    @if (isDraft()) {
      <ui-button variant="ghost" size="sm" class="delete" [loading]="deleting()" (click)="confirming.set(true)">
        Delete draft
      </ui-button>
      <ui-confirm-dialog
        [(open)]="confirming"
        title="Delete this draft?"
        message="The event, its guest list and anything added to it are removed for good. This can't be undone."
        confirmLabel="Delete draft"
        cancelLabel="Keep it"
        [destructive]="true"
        (confirm)="remove()"
      />
    }
  `,
  styles: `
    :host { display: contents; }
    .delete { color: var(--ui-color-danger); }
  `,
})
export class DeleteDraftComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();

  protected readonly isDraft = signal(false);
  protected readonly confirming = signal(false);
  protected readonly deleting = signal(false);

  ngOnInit(): void {
    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (s) => this.isDraft.set(s.status === 'Draft'),
      error: () => this.isDraft.set(false),
    });
  }

  protected remove(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.api.deleteCampaign(this.campaignId()).subscribe({
      next: () => {
        this.toast.success('Draft deleted.');
        void this.router.navigate(['/inbox'], { queryParams: { tab: 'mine' } });
      },
      error: () => this.deleting.set(false),
    });
  }
}

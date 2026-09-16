import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiTextarea } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../shared/api/api.service';
import type { TemplateReport } from '../designer/model/scene';

const REASONS: Record<string, string> = {
  offensive: 'Offensive or inappropriate', copyright: 'Copies someone else’s work', spam: 'Spam or advertising',
  broken: 'Broken or unusable', other: 'Something else',
};

/**
 * Reports on gallery templates. Designer-built templates go live without review, so this queue is
 * how the gallery is kept clean after the fact: dismiss, unlist (out of the gallery, the owner keeps
 * it), or remove (inactive, and the owner can no longer publish to the gallery).
 */
@Component({
  selector: 'app-admin-template-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, UiBadge, UiButton, UiSegmented, UiCard, UiConfirmDialog, UiEmptyState, UiTextarea, UiSpinner],
  template: `
    <div class="head">
      <ui-segmented size="sm" label="Show" [options]="filters" [value]="status()" (valueChange)="setStatus($event)" />
      <ui-button size="sm" variant="ghost" (click)="load()">Refresh</ui-button>
    </div>

    @if (loading()) {
      <div class="centered"><ui-spinner /></div>
    } @else if (!reports().length) {
      <ui-empty-state heading="No reports" [description]="status() === 'open' ? 'Nobody has flagged a template.' : 'Nothing to show here.'" />
    } @else {
      <div class="list">
        @for (r of reports(); track r.id) {
          <ui-card padding="md" class="report">
            <div class="thumb">
              @if (r.templatePreviewUrl) { <img [src]="r.templatePreviewUrl" alt="" /> }
            </div>
            <div class="body">
              <div class="title">
                <a [routerLink]="['/templates', r.templateSlug]" target="_blank" rel="noopener">{{ r.templateName }}</a>
                <ui-badge [tone]="r.templateVisibility === 'Public' ? 'success' : 'neutral'">{{ r.templateVisibility }}</ui-badge>
                @if (!r.templateActive) { <ui-badge tone="danger">Removed</ui-badge> }
                @if (r.reportsForTemplate > 1) { <ui-badge tone="warning">{{ r.reportsForTemplate }} reports</ui-badge> }
              </div>
              <p class="meta">By {{ r.designerName ?? 'the platform' }} · reported {{ r.createdAt | date: 'medium' }}</p>
              <p class="reason"><strong>{{ reasonLabel(r.reason) }}</strong>@if (r.details) { — {{ r.details }} }</p>
              @if (r.status === 'Resolved') {
                <p class="resolved">{{ r.resolution }}@if (r.resolutionNote) { · {{ r.resolutionNote }} } · {{ r.resolvedAt | date: 'medium' }}</p>
              } @else {
                <ui-textarea [rows]="2" placeholder="Note for the record (optional)" [(ngModel)]="notes[r.id]" />
                <div class="actions">
                  <ui-button size="sm" variant="ghost" [disabled]="busy() === r.id" (click)="resolve(r, 'dismiss')">Dismiss</ui-button>
                  <ui-button size="sm" variant="outline" [disabled]="busy() === r.id" (click)="resolve(r, 'unlist')">Unlist</ui-button>
                  <ui-button size="sm" variant="destructive" [disabled]="busy() === r.id" (click)="pendingRemove.set(r)">Remove</ui-button>
                </div>
              }
              @if (r.status === 'Resolved' && (r.resolution === 'unlisted' || r.resolution === 'removed')) {
                <div class="actions">
                  <ui-button size="sm" variant="ghost" (click)="relist(r)">Lift the hold</ui-button>
                  @if (r.resolution === 'removed' && r.designerUserId) {
                    <ui-button size="sm" variant="ghost" (click)="restore(r)">Restore gallery publishing for the designer</ui-button>
                  }
                </div>
              }
            </div>
          </ui-card>
        }
      </div>
    }

    <ui-confirm-dialog
      [open]="!!pendingRemove()"
      (openChange)="!$event && pendingRemove.set(null)"
      title="Remove this template?"
      [message]="'“' + (pendingRemove()?.templateName ?? '') + '” will leave the gallery and can’t start new events. Its designer loses gallery publishing until an admin restores it. Invitations already sent keep working.'"
      confirmLabel="Remove"
      [destructive]="true"
      (confirm)="pendingRemove() && resolve(pendingRemove()!, 'remove')" />
  `,
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px 0; }
    .centered { display: grid; place-items: center; min-height: 160px; }
    .list { display: grid; gap: 12px; }
    .report { display: grid; grid-template-columns: 90px 1fr; gap: 16px; }
    .thumb { aspect-ratio: 9 / 16; border-radius: var(--ui-radius-sm); overflow: hidden; background: var(--ui-color-surface-subtle); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .body { display: grid; gap: 6px; align-content: start; }
    .title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; }
    .title a { color: var(--ui-color-text); }
    .meta, .resolved { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .reason { margin: 0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  `,
})
export class AdminTemplateReportsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly filters = [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }];
  protected readonly status = signal<'open' | 'resolved' | 'all'>('open');
  protected readonly reports = signal<TemplateReport[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly pendingRemove = signal<TemplateReport | null>(null);
  protected notes: Record<string, string> = {};

  constructor() {
    void this.load();
  }

  protected setStatus(value: string | null): void {
    this.status.set((value as 'open' | 'resolved' | 'all') ?? 'open');
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.reports.set(await firstValueFrom(this.api.templateReports(this.status())));
    } finally {
      this.loading.set(false);
    }
  }

  protected reasonLabel(reason: string): string {
    return REASONS[reason] ?? reason;
  }

  protected async resolve(r: TemplateReport, action: 'dismiss' | 'unlist' | 'remove'): Promise<void> {
    this.busy.set(r.id);
    this.pendingRemove.set(null);
    try {
      await firstValueFrom(this.api.resolveTemplateReport(r.id, action, this.notes[r.id] ?? ''));
      this.toast.success(action === 'dismiss' ? 'Report dismissed.' : action === 'unlist' ? 'Template unlisted.' : 'Template removed.');
      await this.load();
    } finally {
      this.busy.set(null);
    }
  }

  protected async relist(r: TemplateReport): Promise<void> {
    await firstValueFrom(this.api.relistTemplate(r.templateId));
    this.toast.success('Hold lifted — the owner can list it again.');
  }

  protected async restore(r: TemplateReport): Promise<void> {
    await firstValueFrom(this.api.restorePublicPublishing(r.designerUserId!));
    this.toast.success('The designer can publish to the gallery again.');
  }
}

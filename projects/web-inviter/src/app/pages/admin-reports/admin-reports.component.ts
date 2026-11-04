import { LocalDatePipe } from '../../shared/pipes/event-time.pipe';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiTextarea } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { reasonLabel } from '../../shared/moderation/moderation.store';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { AdminContentReport } from '../../shared/utils/types/api.types';

export const REPORT_FILTERS = ['open', 'resolved', 'all'] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

/** An action waiting on the confirm dialog. */
type Pending =
  | { action: 'remove'; report: AdminContentReport }
  | { action: 'suspend' | 'reinstate'; report: AdminContentReport };

const KIND: Record<string, string> = { post: 'Post', comment: 'Comment', photo: 'Photo or video', user: 'Person' };

/**
 * Reported posts, comments, photos and people (App Store guideline 1.2, Play's UGC policy). Each
 * report is answered here: dismiss it, remove the thing for everyone, and suspend (or reinstate) the
 * account behind it. Reports on gallery templates are a separate queue, a tab of Administrative.
 */
@Component({
  selector: 'app-admin-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe, FormsModule, RouterLink, SettingsBackComponent,
    UiBadge, UiButton, UiCard, UiConfirmDialog, UiEmptyState, UiSpinner, UiTab, UiTabs, UiText, UiTextarea,
  ],
  template: `
    <section class="wrap">
      <div class="ib-container">
        <app-settings-back />
        <header class="head">
          <span class="eyebrow">Admin</span>
          <ui-text variant="h1">Reports</ui-text>
          <p class="sub">
            Posts, comments, photos and people that someone reported. Reports on gallery templates are in
            <a routerLink="/admin" [queryParams]="{ tab: 'reports' }">Administrative › Reports</a>.
          </p>
        </header>

        <ui-tabs label="Reports" [selectedIndex]="tab()" (selectedIndexChange)="setTab($event)">
          @for (f of filters; track f; let i = $index) {
            <ui-tab [label]="filterLabels[f]">
              @if (tab() === i) {
                <div class="toolbar">
                  <ui-button size="sm" variant="ghost" (click)="load()">Refresh</ui-button>
                </div>
                @if (loading()) {
                  <div class="centered"><ui-spinner /></div>
                } @else if (!reports().length) {
                  <ui-empty-state
                    heading="No reports"
                    [description]="f === 'open' ? 'Nothing is waiting for a look.' : 'Nothing to show here.'"
                  />
                } @else {
                  <div class="list">
                    @for (r of reports(); track r.id) {
                      <ui-card padding="md">
                        <article class="report" [attr.data-report]="r.id">
                          <div class="title">
                            <ui-badge tone="neutral">{{ kindLabel(r.kind) }}</ui-badge>
                            <strong>{{ reason(r.reason) }}</strong>
                            @if (r.reportCount > 1) {
                              <ui-badge tone="warning">{{ r.reportCount }} reports</ui-badge>
                            }
                            @if (r.status === 'Resolved') {
                              <ui-badge [tone]="r.resolution === 'removed' ? 'danger' : 'neutral'">{{ resolutionLabel(r) }}</ui-badge>
                            }
                            @if (r.itemGone) {
                              <ui-badge tone="neutral">No longer there</ui-badge>
                            }
                          </div>

                          <p class="meta">
                            @if (r.eventTitle) { {{ r.eventTitle }} · }
                            reported {{ r.createdAt | localDate: 'datetime' }}
                          </p>

                          @if (r.note) {
                            <p class="note">“{{ r.note }}”</p>
                          }

                          <!-- What it says or shows now; what it said when reported, once it is gone. -->
                          <div class="shows">
                            @if (!r.itemGone && r.currentImageUrl) {
                              <img class="shows__img" [src]="r.currentImageUrl" alt="The reported picture" />
                            }
                            @if (!r.itemGone && r.currentText) {
                              <blockquote class="shows__text">{{ r.currentText }}</blockquote>
                            }
                            @if (r.itemGone && r.snapshot) {
                              <p class="shows__label">When it was reported:</p>
                              <blockquote class="shows__text">{{ r.snapshot }}</blockquote>
                            }
                          </div>

                          <dl class="people">
                            <div>
                              <dt>Reported by</dt>
                              <dd>{{ r.reporterName }}@if (r.reporterEmail) { · {{ r.reporterEmail }} }</dd>
                            </div>
                            <div>
                              <dt>Whose</dt>
                              <dd>
                                @if (r.subjectUserId) {
                                  {{ r.subjectName ?? 'Unknown' }}@if (r.subjectEmail) { · {{ r.subjectEmail }} }
                                  <ui-badge [tone]="r.subjectActive ? 'success' : 'danger'">{{ r.subjectActive ? 'Active' : 'Suspended' }}</ui-badge>
                                } @else {
                                  Not known
                                }
                              </dd>
                            </div>
                          </dl>

                          @if (r.status === 'Resolved' && r.resolutionNote) {
                            <p class="meta">Note: {{ r.resolutionNote }}</p>
                          }

                          @if (r.status !== 'Resolved') {
                            <ui-textarea [rows]="2" placeholder="Note for the record (optional)" [(ngModel)]="notes[r.id]" />
                          }
                          <div class="actions">
                            @if (r.status !== 'Resolved') {
                              @if (!r.itemGone) {
                                <ui-button size="sm" variant="destructive" [disabled]="busy() === r.id" (click)="ask('remove', r)">
                                  {{ r.kind === 'user' ? 'Reset name and picture' : 'Remove for everyone' }}
                                </ui-button>
                              }
                              <ui-button size="sm" variant="outline" [disabled]="busy() === r.id" (click)="dismiss(r)">Dismiss</ui-button>
                            }
                            @if (r.subjectUserId) {
                              @if (r.subjectActive) {
                                <ui-button size="sm" variant="ghost" [disabled]="busy() === r.id" (click)="ask('suspend', r)">Suspend account</ui-button>
                              } @else {
                                <ui-button size="sm" variant="ghost" [disabled]="busy() === r.id" (click)="ask('reinstate', r)">Reinstate account</ui-button>
                              }
                            }
                          </div>
                        </article>
                      </ui-card>
                    }
                  </div>
                }
              }
            </ui-tab>
          }
        </ui-tabs>
      </div>
    </section>

    <ui-confirm-dialog
      [open]="!!pending()"
      (openChange)="!$event && pending.set(null)"
      [title]="confirmTitle()"
      [message]="confirmMessage()"
      [confirmLabel]="confirmLabel()"
      [destructive]="pending()?.action !== 'reinstate'"
      (confirm)="confirmed()"
    />
  `,
  styles: `
    .wrap { padding: clamp(2rem, 5vw, 3.5rem) 0 4rem; }
    .head { margin-bottom: 1.5rem; }
    .eyebrow {
      display: block; margin-bottom: 0.35rem; font-size: 0.75rem; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--ui-color-primary);
    }
    .sub { margin: 0.5rem 0 0; color: var(--ui-color-text-muted); }
    .toolbar { display: flex; justify-content: flex-end; margin: 12px 0; }
    .centered { display: grid; place-items: center; min-height: 160px; }
    .list { display: grid; gap: 12px; }
    .report { display: grid; gap: 8px; min-width: 0; overflow-wrap: anywhere; }
    .title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .meta, .shows__label { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .note { margin: 0; font-style: italic; }
    .shows { display: grid; gap: 8px; justify-items: start; }
    .shows:empty { display: none; }
    .shows__img { max-width: min(100%, 240px); max-height: 240px; border-radius: var(--ui-radius-sm); object-fit: cover; }
    .shows__text {
      margin: 0; padding: 8px 12px; border-left: 3px solid var(--ui-color-border-strong);
      background: var(--ui-color-surface-subtle); border-radius: var(--ui-radius-sm); white-space: pre-line;
    }
    .people { display: grid; gap: 4px; margin: 0; font-size: var(--ui-font-size-sm); }
    .people div { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .people dt { color: var(--ui-color-text-muted); }
    .people dt::after { content: ':'; }
    .people dd { margin: 0; display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `,
})
export class AdminReportsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly filters = REPORT_FILTERS;
  protected readonly filterLabels: Record<ReportFilter, string> = { open: 'Open', resolved: 'Resolved', all: 'All' };
  protected readonly tab = signal(0);
  protected readonly reports = signal<AdminContentReport[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly pending = signal<Pending | null>(null);
  protected notes: Record<string, string> = {};

  protected readonly status = computed<ReportFilter>(() => REPORT_FILTERS[this.tab()] ?? 'open');

  constructor() {
    void this.load();
  }

  protected setTab(index: number): void {
    this.tab.set(index);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.reports.set((await firstValueFrom(this.api.contentReports(this.status()))) ?? []);
    } catch {
      // The API toast says why; an empty list beats a spinner that never stops.
      this.reports.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected kindLabel(kind: string): string {
    return KIND[kind] ?? kind;
  }

  protected reason(value: string): string {
    return reasonLabel(value);
  }

  protected resolutionLabel(r: AdminContentReport): string {
    return r.resolution === 'removed' ? 'Removed' : r.resolution === 'dismissed' ? 'Dismissed' : (r.resolution ?? 'Resolved');
  }

  protected ask(action: Pending['action'], report: AdminContentReport): void {
    this.pending.set({ action, report } as Pending);
  }

  protected readonly confirmTitle = computed(() => {
    const p = this.pending();
    if (!p) return '';
    if (p.action === 'suspend') return `Suspend ${p.report.subjectName ?? 'this account'}?`;
    if (p.action === 'reinstate') return `Reinstate ${p.report.subjectName ?? 'this account'}?`;
    return p.report.kind === 'user' ? 'Reset their name and picture?' : `Remove this ${this.noun(p.report)} for everyone?`;
  });

  protected readonly confirmMessage = computed(() => {
    const p = this.pending();
    if (!p) return '';
    if (p.action === 'suspend') return 'They are signed out at once and can’t sign in until an admin reinstates them.';
    if (p.action === 'reinstate') return 'They can sign in and use invites.blog again.';
    if (p.report.kind === 'user') return 'Their profile picture is removed and their name becomes “invites.blog member”. They can choose new ones.';
    return 'Nobody will see it any more, and every open report about it is closed.';
  });

  protected readonly confirmLabel = computed(() => {
    const action = this.pending()?.action;
    return action === 'suspend' ? 'Suspend' : action === 'reinstate' ? 'Reinstate' : 'Remove';
  });

  private noun(r: AdminContentReport): string {
    return r.kind === 'photo' ? 'photo or video' : r.kind;
  }

  protected async confirmed(): Promise<void> {
    // Read before the dialog closes itself, which clears it.
    const p = this.pending();
    if (!p) return;
    if (p.action === 'remove') await this.resolve(p.report, 'remove');
    else await this.suspend(p.report, p.action === 'suspend');
  }

  protected dismiss(r: AdminContentReport): Promise<void> {
    return this.resolve(r, 'dismiss');
  }

  private async resolve(r: AdminContentReport, action: 'dismiss' | 'remove'): Promise<void> {
    this.busy.set(r.id);
    try {
      await firstValueFrom(this.api.resolveContentReport(r.id, action, this.notes[r.id] ?? null));
      this.toast.success(action === 'dismiss' ? 'Report dismissed.' : 'Removed for everyone.');
      await this.load();
    } catch {
      // The API toast says why.
    } finally {
      this.busy.set(null);
    }
  }

  private async suspend(r: AdminContentReport, suspended: boolean): Promise<void> {
    if (!r.subjectUserId) return;
    this.busy.set(r.id);
    try {
      await firstValueFrom(this.api.setUserSuspended(r.subjectUserId, suspended));
      this.toast.success(suspended ? `${r.subjectName ?? 'The account'} is suspended.` : `${r.subjectName ?? 'The account'} is reinstated.`);
      await this.load();
    } catch {
      // The API toast says why.
    } finally {
      this.busy.set(null);
    }
  }
}

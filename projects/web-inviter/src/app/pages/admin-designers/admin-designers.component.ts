import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { AdminDesigner, DesignerEarnings } from '../../shared/utils/types/api.types';

/**
 * Designer management and the earnings report (§Phase 7). Earnings are derived from what was
 * actually agreed and actually charged, so this view can't drift from the money — but paying it out
 * stays a separate, deliberate act elsewhere.
 */
@Component({
  selector: 'app-admin-designers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, UiBadge, UiButton, UiCard, UiConfirmDialog, UiEmptyState,
    UiFormField, UiSearchInput, UiSpinner, UiTab, UiTabs, UiText,
  ],
  templateUrl: './admin-designers.component.html',
  styleUrl: './admin-designers.component.scss',
})
export class AdminDesignersComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly loading = signal(true);
  protected readonly designers = signal<AdminDesigner[]>([]);
  protected search = '';

  protected readonly earnings = signal<DesignerEarnings[]>([]);
  protected readonly earningsLoaded = signal(false);
  protected readonly busy = signal<string | null>(null);
  /** The designer awaiting a yes/no before being suspended. */
  protected readonly pendingSuspend = signal<AdminDesigner | null>(null);
  protected readonly suspendMessage = computed(() => {
    const d = this.pendingSuspend();
    if (!d) return '';
    return `“${d.displayName}” won’t be able to sign in or submit new templates. Their already-published templates stay live.`;
  });

  protected readonly payableTotal = computed(() =>
    this.earnings().reduce((sum, e) => sum + e.total, 0),
  );

  constructor() {
    this.load();
  }

  protected onSearch(): void {
    this.load();
  }

  /** Suspending blocks sign-in and submissions, so it asks first; reinstating doesn't need to. */
  protected toggleSuspended(designer: AdminDesigner): void {
    if (designer.isActive) {
      this.pendingSuspend.set(designer);
    } else {
      this.applySuspend(designer);
    }
  }

  protected confirmSuspend(): void {
    const designer = this.pendingSuspend();
    this.pendingSuspend.set(null);
    if (designer) this.applySuspend(designer);
  }

  private applySuspend(designer: AdminDesigner): void {
    this.busy.set(designer.userId);
    this.api.setDesignerSuspended(designer.userId, designer.isActive).subscribe({
      next: (updated) => {
        this.designers.update((list) =>
          list.map((d) => (d.userId === updated.userId ? updated : d)),
        );
        this.busy.set(null);
        this.toast.success(
          updated.isActive
            ? `${updated.displayName} can submit again.`
            : `${updated.displayName} is suspended. Their published templates stay live.`,
        );
      },
      error: () => this.busy.set(null),
    });
  }

  /** Earnings are only fetched when that tab is actually opened. */
  protected loadEarnings(): void {
    if (this.earningsLoaded()) return;
    this.earningsLoaded.set(true);
    this.api.designerEarnings().subscribe({
      next: (list) => this.earnings.set(list),
      error: () => this.earningsLoaded.set(false),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listDesigners(1, this.search).subscribe({
      next: (page) => {
        this.designers.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

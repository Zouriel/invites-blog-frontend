import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiSearchInput } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiText } from 'ui/text';
import { UiToastService } from 'ui/dialog';
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
    DecimalPipe, FormsModule, UiBadge, UiButton, UiCard, UiEmptyState,
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

  protected readonly payableTotal = computed(() =>
    this.earnings().reduce((sum, e) => sum + e.total, 0),
  );

  constructor() {
    this.load();
  }

  protected onSearch(): void {
    this.load();
  }

  protected toggleSuspended(designer: AdminDesigner): void {
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

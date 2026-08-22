import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiNumberInput, UiSearchInput } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { UiConfirmDialog, UiToastService } from 'ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { MyTemplateRow, MyTemplatesPage } from '../../shared/utils/types/api.types';

/**
 * One screen for both audiences. The API decides the scope from the caller's roles — an admin gets
 * every template on the platform, a designer only their own — and the title follows, so nobody has
 * to reason about which list they're looking at.
 *
 * Editing is role-aware too: an admin publishes directly, a designer's edit becomes a submission for
 * review. The row says which, rather than leaving them to find out after the fact.
 */
@Component({
  selector: 'app-my-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, FormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard,
    UiConfirmDialog, UiEmptyState, UiFormField, UiNumberInput, UiSearchInput, UiSpinner, UiText,
  ],
  templateUrl: './my-templates.component.html',
  styleUrl: './my-templates.component.scss',
})
export class MyTemplatesComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  protected readonly loading = signal(true);
  protected readonly page = signal<MyTemplatesPage | null>(null);
  protected readonly busyId = signal<string | null>(null);
  /** The row awaiting a yes/no in the confirm dialog. */
  protected readonly pendingDelete = signal<MyTemplateRow | null>(null);

  protected readonly deleteMessage = computed(() => {
    const row = this.pendingDelete();
    if (!row) return '';
    return row.campaignCount > 0
      ? `“${row.name}” is used by ${row.campaignCount} invitation${row.campaignCount === 1 ? '' : 's'}. ` +
        'It will be removed from the gallery, but those invitations keep working.'
      : `“${row.name}” will be deleted. This can't be undone.`;
  });
  protected search = '';

  /** The row whose price is being edited, and the value being typed. */
  protected readonly pricingId = signal<string | null>(null);
  protected usagePrice: number | null = null;
  protected commissionPrice: number | null = null;

  protected readonly isAdmin = this.session.isAdmin;
  protected readonly title = computed(() => this.page()?.title ?? 'Templates');
  protected readonly isSystemScope = computed(() => this.page()?.scope === 'system');

  protected readonly rows = computed(() => {
    const all = this.page()?.templates ?? [];
    const term = this.search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.slug.toLowerCase().includes(term) ||
        (t.designerName ?? '').toLowerCase().includes(term),
    );
  });

  constructor() {
    this.load();
  }

  protected refresh(): void {
    this.load();
  }

  // ----- Pricing --------------------------------------------------------------------------------

  protected openPricing(row: MyTemplateRow): void {
    this.pricingId.set(row.id);
    this.usagePrice = row.usagePrice;
    this.commissionPrice = row.commissionPrice;
  }

  protected cancelPricing(): void {
    this.pricingId.set(null);
  }

  protected savePricing(row: MyTemplateRow): void {
    this.busyId.set(row.id);
    this.api.setTemplatePricing(row.id, this.usagePrice, this.commissionPrice).subscribe({
      next: (updated) => {
        this.page.update((p) =>
          p ? { ...p, templates: p.templates.map((t) => (t.id === updated.id ? updated : t)) } : p,
        );
        this.busyId.set(null);
        this.pricingId.set(null);
        this.toast.success('Price updated. It applies to new invitations from now on.');
      },
      error: () => this.busyId.set(null),
    });
  }

  // ----- Edit + delete ---------------------------------------------------------------------------

  /**
   * An admin edits the live template; a designer submits a revision for review. Both start from the
   * template's current source, which the edit screens load by id.
   */
  protected edit(row: MyTemplateRow): void {
    if (row.canEditDirectly) {
      void this.router.navigate(['/admin/upload'], { queryParams: { template: row.id } });
    } else {
      void this.router.navigate(['/designer'], { queryParams: { revise: row.id } });
    }
  }

  /** Asks first — the dialog carries what actually happens, which differs for a template in use. */
  protected remove(row: MyTemplateRow): void {
    this.pendingDelete.set(row);
  }

  protected confirmDelete(): void {
    const row = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!row) return;

    this.busyId.set(row.id);
    this.api.deleteMyTemplate(row.id).subscribe({
      next: (outcome) => {
        this.busyId.set(null);
        this.toast.success(outcome.message);
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.myTemplates().subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

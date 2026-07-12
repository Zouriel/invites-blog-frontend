import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiFormField, UiSelect, UiSelectOption } from 'ui/form';
import { UiToastService } from 'ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { AdminTemplate, TemplateTypeDto } from '../../shared/utils/types/api.types';

/** Admin templates list — Active / Deactivated tabs, search, category filter, pagination. */
@Component({
  selector: 'app-admin-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiBadge,
    UiButton,
    UiCard,
    UiText,
    UiSpinner,
    UiEmptyState,
    UiTabs,
    UiTab,
    UiFormField,
    UiSelect,
  ],
  templateUrl: './admin-templates.component.html',
  styleUrl: './admin-templates.component.scss',
})
export class AdminTemplatesComponent {
  private readonly api = inject(ApiService);
  private readonly toasts = inject(UiToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly templates = signal<AdminTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly deletingId = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly tabIndex = signal(0);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  protected readonly tabs = [
    { label: 'Active', status: 'active' },
    { label: 'Deactivated', status: 'inactive' },
  ] as const;

  /** Category filter — a reactive control so the ui-select drives reloads. */
  protected readonly categoryControl = this.fb.control('');
  private readonly types = signal<TemplateTypeDto[]>([]);
  protected readonly categoryOptions = computed<UiSelectOption[]>(() => [
    { label: 'All categories', value: '' },
    ...this.types().map((t) => ({ label: t.name, value: t.name })),
  ]);

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.api.listTemplateTypes().subscribe({ next: (t) => this.types.set(t) });
    this.categoryControl.valueChanges.subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .listAdminTemplates(this.page(), this.search(), this.categoryControl.value, this.tabs[this.tabIndex()].status)
      .subscribe({
        next: (p) => {
          this.templates.set(p.items);
          this.totalPages.set(p.totalPages);
          this.totalCount.set(p.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected onTab(index: number): void {
    this.tabIndex.set(index);
    this.page.set(1);
    this.load();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  protected prev(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  protected next(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  protected preview(packageUrl: string): void {
    window.open(packageUrl + 'index.html', '_blank', 'noopener');
  }

  protected removeTemplate(t: AdminTemplate): void {
    if (this.deletingId()) return;
    const warn =
      t.campaignCount > 0
        ? `“${t.name}” is used by ${t.campaignCount} campaign(s). It will be deactivated (hidden from the gallery) so existing invites keep working. Continue?`
        : `Delete “${t.name}” permanently? This can't be undone.`;
    if (!confirm(warn)) return;

    this.deletingId.set(t.id);
    this.api.deleteTemplate(t.id).subscribe({
      next: (res) => {
        this.deletingId.set(null);
        this.toasts.success(res.deactivated ? `“${t.name}” was deactivated.` : `“${t.name}” was deleted.`);
        this.load();
      },
      error: () => this.deletingId.set(null),
    });
  }
}

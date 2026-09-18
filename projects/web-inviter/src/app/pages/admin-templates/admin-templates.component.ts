import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { debounceTime } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiPagination } from '@zouriel/ui/navigation';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiCheckbox, UiFormField, UiSearchInput, UiSelect, UiSelectOption } from '@zouriel/ui/form';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import { ApiService } from '../../shared/api/api.service';
import { AdminTemplate, TemplateTypeDto } from '../../shared/utils/types/api.types';

/** Admin templates list — Active / Deactivated tabs, search, category filter, pagination. */
@Component({
  selector: 'app-admin-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HugeiconsIconComponent,
    UiCheckbox,
    DatePipe,
    SafeUrlPipe,
    ReactiveFormsModule,
    RouterLink,
    UiBadge,
    UiButton,
    UiCard,
    UiConfirmDialog,
    UiText,
    UiSkeleton,
    UiEmptyState,
    UiPagination,
    UiTabs,
    UiTab,
    UiFormField,
    UiSearchInput,
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
  /** The template awaiting a yes/no in the confirm dialog. */
  protected readonly pendingDelete = signal<AdminTemplate | null>(null);

  protected readonly deleteMessage = computed(() => {
    const t = this.pendingDelete();
    if (!t) return '';
    return t.campaignCount > 0
      ? `“${t.name}” is used by ${t.campaignCount} campaign${t.campaignCount === 1 ? '' : 's'}. ` +
        'It will be hidden from the gallery so existing invites keep working.'
      : `“${t.name}” will be deleted permanently. This can't be undone.`;
  });

  protected readonly searchControl = this.fb.control('');
  protected readonly categoryControl = this.fb.control('');
  /** Gallery templates only — ticked by default, the ones customers actually see. */
  protected readonly onlyPublicControl = this.fb.control(true);
  /** The public template awaiting a yes/no before it leaves the gallery. */
  protected readonly pendingUnpublish = signal<AdminTemplate | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly tabIndex = signal(0);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);
  protected readonly skeletons = Array.from({ length: 6 });

  protected readonly tabs = [
    { label: 'Active', status: 'active' },
    { label: 'Deactivated', status: 'inactive' },
  ] as const;

  private readonly types = signal<TemplateTypeDto[]>([]);
  protected readonly categoryOptions = computed<UiSelectOption[]>(() => [
    { label: 'All categories', value: '' },
    ...this.types().map((t) => ({ label: t.name, value: t.name })),
  ]);

  constructor() {
    this.api.listTemplateTypes().subscribe({ next: (t) => this.types.set(t) });
    this.searchControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.categoryControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.onlyPublicControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .listAdminTemplates(
        this.page(),
        this.searchControl.value,
        this.categoryControl.value,
        this.tabs[this.tabIndex()].status,
        this.onlyPublicControl.value,
      )
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

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected readonly openIcon = ArrowUpRight01Icon;

  protected liveUrl(t: AdminTemplate): string {
    return t.packageUrl.replace(/\/?$/, '/') + 'index.html';
  }

  /**
   * Opens the published page on its own. Built from the site root: a relative "index.html" (a row
   * with no package) resolved against /admin and landed on the home page.
   */
  protected preview(packageUrl: string): void {
    if (!packageUrl) return;
    const url = new URL(packageUrl.replace(/\/?$/, '/') + 'index.html', window.location.origin);
    window.open(url.toString(), '_blank', 'noopener');
  }

  /** Public, Private, or made for one person — what a card says about who can use the template. */
  protected visibilityOf(t: AdminTemplate): { label: string; tone: 'success' | 'neutral' | 'primary' } {
    if (t.visibility === 'Public') return { label: 'Public', tone: 'success' };
    if (t.assignedEmail || t.visibility === 'Dedicated') return { label: 'For someone', tone: 'primary' };
    return { label: 'Private', tone: 'neutral' };
  }

  protected confirmUnpublish(): void {
    const t = this.pendingUnpublish();
    this.pendingUnpublish.set(null);
    if (!t) return;
    this.busyId.set(t.id);
    this.api.unpublishTemplate(t.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toasts.success(`“${t.name}” is out of the gallery. Only its creator can use it now.`);
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected republish(t: AdminTemplate): void {
    this.busyId.set(t.id);
    this.api.republishTemplate(t.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toasts.success(`“${t.name}” is back in the gallery.`);
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected removeTemplate(t: AdminTemplate): void {
    if (this.deletingId()) return;
    this.pendingDelete.set(t);
  }

  protected confirmDelete(): void {
    const t = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!t) return;

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

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { UiBadge } from 'ui/badge';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSkeleton } from 'ui/skeleton';
import { UiEmptyState } from 'ui/feedback';
import { UiPagination } from 'ui/navigation';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiSearchInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { InquiryListItem } from '../../shared/utils/types/api.types';

/** Admin queue of custom-invitation inquiries — unattended first, then oldest. */
@Component({
  selector: 'app-admin-inquiries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    UiBadge,
    UiCard,
    UiText,
    UiSkeleton,
    UiEmptyState,
    UiPagination,
    UiTabs,
    UiTab,
    UiSearchInput,
  ],
  templateUrl: './admin-inquiries.component.html',
  styleUrl: './admin-inquiries.component.scss',
})
export class AdminInquiriesComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly inquiries = signal<InquiryListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly searchControl = this.fb.control('');
  protected readonly tabIndex = signal(0);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);
  protected readonly skeletons = Array.from({ length: 5 });

  /** Tab labels + the backend status each maps to. */
  protected readonly tabs = [
    { label: 'All', status: 'all' },
    { label: 'Not attended', status: 'unattended' },
    { label: 'Attended · not issued', status: 'attended-unissued' },
  ] as const;

  constructor() {
    this.searchControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((v) => {
      this.search.set(v);
      this.page.set(1);
      this.load();
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listInquiries(this.page(), this.search(), this.tabs[this.tabIndex()].status).subscribe({
      next: (p) => {
        this.inquiries.set(p.items);
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

  protected open(id: string): void {
    this.router.navigate(['/admin/inquiries', id]);
  }
}

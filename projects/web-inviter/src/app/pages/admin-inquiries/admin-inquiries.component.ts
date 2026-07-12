import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { UiTab, UiTabs } from 'ui/tabs';
import { ApiService } from '../../shared/api/api.service';
import { AdminStore } from '../../shared/services/admin.store';
import { InquiryListItem } from '../../shared/utils/types/api.types';

/** Admin queue of custom-invitation inquiries — unattended first, then oldest. */
@Component({
  selector: 'app-admin-inquiries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, UiBadge, UiButton, UiCard, UiText, UiSpinner, UiEmptyState, UiTabs, UiTab],
  templateUrl: './admin-inquiries.component.html',
  styleUrl: './admin-inquiries.component.scss',
})
export class AdminInquiriesComponent {
  private readonly api = inject(ApiService);
  private readonly admin = inject(AdminStore);
  private readonly router = inject(Router);

  protected readonly inquiries = signal<InquiryListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly tabIndex = signal(0);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  /** Tab labels + the backend status each maps to. */
  protected readonly tabs = [
    { label: 'All', status: 'all' },
    { label: 'Not attended', status: 'unattended' },
    { label: 'Attended · not issued', status: 'attended-unissued' },
  ] as const;

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  protected onTab(index: number): void {
    this.tabIndex.set(index);
    this.page.set(1);
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

  protected open(id: string): void {
    this.router.navigate(['/admin/inquiries', id]);
  }

  protected logout(): void {
    this.admin.clear();
    this.router.navigate(['/admin/login']);
  }
}

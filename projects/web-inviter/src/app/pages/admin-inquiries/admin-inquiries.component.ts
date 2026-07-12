import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { ApiService } from '../../shared/api/api.service';
import { AdminStore } from '../../shared/services/admin.store';
import { InquiryListItem } from '../../shared/utils/types/api.types';

/** Admin queue of custom-invitation inquiries — unattended first, then oldest. */
@Component({
  selector: 'app-admin-inquiries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, UiBadge, UiButton, UiCard, UiText, UiSpinner, UiEmptyState],
  templateUrl: './admin-inquiries.component.html',
  styleUrl: './admin-inquiries.component.scss',
})
export class AdminInquiriesComponent {
  private readonly api = inject(ApiService);
  private readonly admin = inject(AdminStore);
  private readonly router = inject(Router);

  protected readonly inquiries = signal<InquiryListItem[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.api.listInquiries().subscribe({
      next: (items) => {
        this.inquiries.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(id: string): void {
    this.router.navigate(['/admin/inquiries', id]);
  }

  protected logout(): void {
    this.admin.clear();
    this.router.navigate(['/admin/login']);
  }
}

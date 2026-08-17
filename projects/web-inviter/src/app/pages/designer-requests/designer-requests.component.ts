import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { DesignerCommission } from '../../shared/utils/types/api.types';

/**
 * A designer's side of the request queue — the counterpart to the admin's Inquiries page.
 *
 * Two kinds of row land here: work an admin has actually HANDED to them (they can start building),
 * and requests where a customer ASKED FOR THEM by name but the terms aren't agreed yet. The second
 * kind is read-only on purpose: the price is settled between the customer and the platform first,
 * and submitting against an unassigned request is refused by the server anyway.
 */
@Component({
  selector: 'app-designer-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, UiBadge, UiButton, UiCard, UiEmptyState, UiSpinner, UiTab, UiTabs, UiText],
  templateUrl: './designer-requests.component.html',
  styleUrl: './designer-requests.component.scss',
})
export class DesignerRequestsComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly all = signal<DesignerCommission[]>([]);

  /** Handed over and still open — the only ones that can be answered with a submission. */
  protected readonly active = computed(() =>
    this.all().filter((c) => c.assigned && !c.templateIssued),
  );
  /** Asked for by name, terms not agreed. Nothing to do yet but worth knowing about. */
  protected readonly pending = computed(() => this.all().filter((c) => !c.assigned));
  protected readonly delivered = computed(() => this.all().filter((c) => c.templateIssued));

  constructor() {
    this.api.listMyCommissions().subscribe({
      next: (list) => {
        this.all.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Hands the brief to the submit form, which reads the requester and price off the inquiry. */
  protected build(c: DesignerCommission): void {
    void this.router.navigate(['/designer'], { queryParams: { commission: c.inquiryId } });
  }
}

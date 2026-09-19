import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { catalog, mvr, plan } from '../../shared/utils/plans';
import { StudioOverview } from '../../shared/utils/types/api.types';

/**
 * A Studio account's page: its clients' events, and what they pay.
 *
 * <p>A client is someone the designer published a template FOR, or an event the planner organised —
 * never a stranger who used a public design. The discount needs no stock and no code: a client's
 * first event on a design made for them gets the Studio discount off a pass when they buy it.</p>
 */
@Component({
  selector: 'app-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, UiBadge, UiButton, UiCard, UiEmptyState, UiSearchInput, UiSpinner, UiText],
  templateUrl: './studio.component.html',
  styleUrl: './studio.component.scss',
})
export class StudioComponent {
  private readonly api = inject(ApiService);

  protected readonly overview = signal<StudioOverview | null>(null);
  /** Not on Studio: the page explains the plan instead. */
  protected readonly notStudio = signal(false);
  protected readonly failed = signal(false);
  protected readonly query = signal('');
  protected readonly mvr = mvr;
  protected readonly retail = { party: plan('PartyPass').price, wedding: plan('WeddingPass').price };
  protected readonly discount = catalog().studioDiscountPercent;

  protected readonly clients = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.overview()?.clients ?? [];
    if (!q) return all;
    return all.filter((c) => [c.title, c.hostName, c.hostEmail, c.templateName].some((v) => v?.toLowerCase().includes(q)));
  });

  constructor() {
    this.api.studio().subscribe({
      next: (o) => this.overview.set(o),
      error: (e: HttpErrorResponse) => (e.status === 403 ? this.notStudio.set(true) : this.failed.set(true)),
    });
  }
}

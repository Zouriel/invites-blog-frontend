import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../shared/api/api.service';
import { PLAN_CATALOG, mvr, plan } from '../../shared/utils/plans';
import { StudioClient, StudioOverview } from '../../shared/utils/types/api.types';

type PassKind = 'Party' | 'Wedding';

/**
 * A Studio account's page: the passes it holds, and its clients' events.
 *
 * <p>A client is someone the designer published a template FOR, or an event the planner organised —
 * never a stranger who used a public design, whose event is none of the designer's business. Giving a
 * pass puts it on the client's event for a year, from the stock bought at the Studio price.</p>
 */
@Component({
  selector: 'app-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, RouterLink, UiBadge, UiButton, UiCard, UiConfirmDialog, UiEmptyState, UiSearchInput,
    UiSpinner, UiText,
  ],
  templateUrl: './studio.component.html',
  styleUrl: './studio.component.scss',
})
export class StudioComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly overview = signal<StudioOverview | null>(null);
  /** Not on Studio: the page explains the plan instead. */
  protected readonly notStudio = signal(false);
  protected readonly failed = signal(false);
  protected readonly query = signal('');
  protected readonly mvr = mvr;
  protected readonly retail: Record<PassKind, number> = { Party: plan('PartyPass').price, Wedding: plan('WeddingPass').price };
  protected readonly discount = PLAN_CATALOG.studioDiscountPercent;
  protected readonly kinds: PassKind[] = ['Wedding', 'Party'];

  protected readonly clients = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.overview()?.clients ?? [];
    if (!q) return all;
    return all.filter((c) => [c.title, c.hostName, c.hostEmail, c.templateName].some((v) => v?.toLowerCase().includes(q)));
  });

  /** The pass waiting to be confirmed, and for whom. */
  protected readonly giving = signal<{ client: StudioClient; kind: PassKind } | null>(null);
  protected readonly confirming = signal(false);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.studio().subscribe({
      next: (o) => this.overview.set(o),
      error: (e: HttpErrorResponse) => (e.status === 403 ? this.notStudio.set(true) : this.failed.set(true)),
    });
  }

  protected held(kind: PassKind): number {
    const o = this.overview();
    return o ? (kind === 'Wedding' ? o.weddingCredits : o.partyCredits) : 0;
  }

  protected price(kind: PassKind): number {
    const o = this.overview();
    return o ? (kind === 'Wedding' ? o.weddingPassPrice : o.partyPassPrice) : 0;
  }

  /** Whether giving this pass would do anything: a smaller pass never replaces a Wedding one. */
  protected canGive(client: StudioClient, kind: PassKind): boolean {
    return !(client.pass === 'Wedding' && kind === 'Party');
  }

  protected ask(client: StudioClient, kind: PassKind): void {
    if (!this.held(kind)) {
      this.toast.info(`You have no ${kind} passes left. Ask us for more.`);
      return;
    }
    this.giving.set({ client, kind });
    this.confirming.set(true);
  }

  protected confirmMessage(): string {
    const g = this.giving();
    if (!g) return '';
    const again = g.client.pass === g.kind ? ' It already has one, so this adds a year to it.' : '';
    return `${g.client.title} gets a ${g.kind} pass for a year: more photo space, albums and days, and invitations sent for them.${again}`;
  }

  protected give(): void {
    const g = this.giving();
    if (!g || this.busy()) return;
    this.busy.set(g.client.campaignId);
    this.api.studioGivePass(g.client.campaignId, g.kind).subscribe({
      next: (updated) => {
        this.overview.update((o) =>
          o
            ? {
                ...o,
                partyCredits: o.partyCredits - (g.kind === 'Party' ? 1 : 0),
                weddingCredits: o.weddingCredits - (g.kind === 'Wedding' ? 1 : 0),
                clients: o.clients.map((c) => (c.campaignId === updated.campaignId ? updated : c)),
              }
            : o,
        );
        this.busy.set(null);
        this.giving.set(null);
        this.toast.success(`${updated.title} has a ${g.kind} pass.`);
      },
      error: () => this.busy.set(null),
    });
  }
}

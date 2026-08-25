import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiNumberInput, UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import {
  MyCampaign,
  MyTemplateRow,
  MyTemplatesPage,
  Template,
  TemplateRelease,
} from '../../shared/utils/types/api.types';

/**
 * One screen for both sides of a person: **My designs** — the templates they publish — and
 * **My requests** — the templates designed FOR them.
 *
 * Everyone signed in has requests, only designers and admins have designs, so the designs tab is
 * conditional and a customer simply lands on a one-tab page. That's what makes this reachable by
 * customers at all: claiming a template reserved for you used to be a separate email-code page,
 * and an account already proves the same thing its code did.
 *
 * Within the designs tab the API decides the scope from the caller's roles — an admin gets every
 * template on the platform, a designer only their own — and editing follows: an admin publishes
 * directly, a designer's edit becomes a submission for review.
 */
@Component({
  selector: 'app-my-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, FormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard,
    UiConfirmDialog, UiEmptyState, UiFormField, UiNumberInput, UiSearchInput, UiSpinner, UiTab,
    UiTabs, UiText,
  ],
  templateUrl: './my-templates.component.html',
  styleUrl: './my-templates.component.scss',
})
export class MyTemplatesComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);

  protected readonly loading = signal(false);
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
  /** True for admins too — they publish the platform's own templates. */
  protected readonly isDesigner = this.session.isDesigner;
  protected readonly title = computed(() =>
    this.isDesigner() ? (this.page()?.title ?? 'Templates') : 'My templates',
  );
  protected readonly isSystemScope = computed(() => this.page()?.scope === 'system');
  protected readonly eyebrow = computed(() =>
    this.isSystemScope() ? 'Admin' : this.isDesigner() ? 'Designer' : 'Reserved for you',
  );

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

  // ----- My requests -----------------------------------------------------------------------------

  protected readonly requestsLoading = signal(true);
  /** Templates reserved for this account's email, ready to start an invitation from. */
  protected readonly requests = signal<Template[]>([]);
  /** Commissioned templates this person could agree to share with everyone. */
  protected readonly releases = signal<TemplateRelease[]>([]);
  /** Which reserved template is currently spinning up a campaign, if any. */
  protected readonly creatingId = signal<string | null>(null);
  protected readonly releasingId = signal<string | null>(null);

  // ----- Drafts ---------------------------------------------------------------------------------
  /**
   * Invitations started but never paid for. They were only reachable by holding on to the create-flow
   * URL, so an abandoned one was invisible and impossible to clear out.
   */
  protected readonly drafts = signal<MyCampaign[]>([]);
  protected readonly draftsLoading = signal(false);
  protected readonly pendingDraftDelete = signal<MyCampaign | null>(null);
  protected readonly deletingDraftId = signal<string | null>(null);

  protected readonly draftDeleteMessage = computed(() => {
    const d = this.pendingDraftDelete();
    if (!d) return '';
    const guests = d.guestCount > 0
      ? ` Its ${d.guestCount} guest${d.guestCount === 1 ? '' : 's'} will be deleted too.`
      : '';
    return `“${d.title}” will be permanently deleted.${guests} This can't be undone.`;
  });

  constructor() {
    if (this.isDesigner()) this.load();
    this.loadRequests();
    this.loadDrafts();
  }

  protected refresh(): void {
    if (this.isDesigner()) this.load();
    this.loadRequests();
    this.loadDrafts();
  }

  private loadDrafts(): void {
    this.draftsLoading.set(true);
    this.api.myCampaigns().subscribe({
      next: (list) => {
        // Only unpaid work-in-progress belongs here; anything paid or sent is the dashboard's job.
        this.drafts.set((list ?? []).filter((c) => c.status === 'Draft'));
        this.draftsLoading.set(false);
      },
      error: () => this.draftsLoading.set(false),
    });
  }

  protected resumeDraft(draft: MyCampaign): void {
    this.router.navigate(['/create', draft.id, 'editor']);
  }

  protected confirmDraftDelete(): void {
    const draft = this.pendingDraftDelete();
    if (!draft) return;
    this.pendingDraftDelete.set(null);
    this.deletingDraftId.set(draft.id);
    this.api.deleteCampaign(draft.id).subscribe({
      next: () => {
        this.drafts.update((list) => list.filter((d) => d.id !== draft.id));
        this.deletingDraftId.set(null);
        this.toast.success(`“${draft.title}” deleted.`);
      },
      error: () => {
        this.deletingDraftId.set(null);
        this.toast.danger("That draft couldn't be deleted.");
      },
    });
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

  // ----- Starting an invitation from a reserved template ------------------------------------------

  /** Same paid flow the gallery starts, from a template only this account can see. */
  protected use(template: Template): void {
    if (this.creatingId()) return;

    this.creatingId.set(template.id);
    const title = `${template.name} invitation`;
    this.api.createCampaign(template.id, title).subscribe({
      next: (res) => {
        this.api.storeToken(res.campaignId, res.accessToken);
        this.api.storeMeta(res.campaignId, {
          packageUrl: template.packageUrl,
          templateName: template.name,
          title,
        });
        // The wizard opens on Roles — theming and content are both scoped per role.
        void this.router.navigate(['/create', res.campaignId, 'roles']);
      },
      error: () => this.creatingId.set(null),
    });
  }

  /**
   * The requester's half of the two-party consent. Their template only reaches the public gallery
   * once the designer has agreed too — this records their side, nothing more.
   */
  protected release(item: TemplateRelease): void {
    this.releasingId.set(item.templateId);
    this.api.releaseAsRequester(item.templateId).subscribe({
      next: (updated) => {
        this.releases.update((list) =>
          list.map((r) => (r.templateId === updated.templateId ? updated : r)),
        );
        this.releasingId.set(null);
        this.toast.success(
          updated.isPublic
            ? 'Shared — your design is now in the public gallery.'
            : 'Noted. It goes public once the designer agrees too.',
        );
      },
      error: () => this.releasingId.set(null),
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

  private loadRequests(): void {
    this.requestsLoading.set(true);
    this.api.myDedicatedTemplates().subscribe({
      next: (list) => {
        this.requests.set(list);
        this.requestsLoading.set(false);
      },
      error: () => this.requestsLoading.set(false),
    });
    // Commissions this person could release to the public gallery. Best-effort — the tab still
    // works if it fails, it just won't offer the release.
    this.api.myCommissionedTemplates().subscribe({
      next: (list) => this.releases.set(list),
      error: () => this.releases.set([]),
    });
  }
}

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { catalog } from '../../shared/utils/plans';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { TemplateGalleryComponent } from '../../shared/template-gallery/template-gallery.component';
import { templateTabsFor } from '../../shared/services/tab-rail';
import {
  MyCampaign,
  MyRequest,
  MyTemplateRow,
  MyTemplatesPage,
  Template,
  TemplateUse,
} from '../../shared/utils/types/api.types';

/**
 * One screen for both sides of a person: **Studio** — the templates they publish, and who used them — and
 * **Requested** — the designs made FOR them, from the moment they ask to the moment one arrives.
 *
 * Everyone signed in has requests, only designers and admins have designs, so the designs tab is
 * conditional and a customer simply lands on a one-tab page. That's what makes this reachable by
 * customers at all: claiming a template reserved for you used to be a separate email-code page,
 * and an account already proves the same thing its code did.
 *
 * The designs tab lists only what this person published — admins too (the platform's whole catalogue
 * is the admin screen's System templates). Templates are edited in the designer.
 */
@Component({
  selector: 'app-my-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, RouterLink, TemplateGalleryComponent,
    UiAlert, UiBadge, UiButton, UiCard,
    UiConfirmDialog, UiEmptyState, UiFormField, UiModal, UiSearchInput, UiSpinner, UiTab,
    UiTabs, UiText,
  ],
  templateUrl: './my-templates.component.html',
  styleUrl: './my-templates.component.scss',
})
export class MyTemplatesComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(UiToastService);

  protected readonly loading = signal(false);
  protected readonly page = signal<MyTemplatesPage | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly discount = catalog().studioDiscountPercent;

  /** The template whose uses are open, and who used it: events made from it, newest first. */
  protected readonly usesOf = signal<MyTemplateRow | null>(null);
  protected readonly uses = signal<TemplateUse[] | null>(null);

  protected showUses(row: MyTemplateRow): void {
    this.usesOf.set(row);
    this.uses.set(null);
    this.api.myTemplateUses(row.id).subscribe({
      next: (list) => this.uses.set(list),
      error: () => this.uses.set([]),
    });
  }
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

  /** True for admins too — they publish the platform's own templates. */
  protected readonly isDesigner = this.session.isDesigner;
  /**
   * The heading names the PAGE, not whichever tab is open.
   *
   * <p>Each tab says what it holds inside itself; the page heading only names the page.</p>
   */
  protected readonly title = computed(() => 'Templates');
  protected readonly eyebrow = computed(() => (this.isDesigner() ? 'Designs' : 'Invitations'));


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
  /** Which reserved template is currently spinning up a campaign, if any. */
  protected readonly creatingId = signal<string | null>(null);

  // ----- Tab selection ---------------------------------------------------------------------------
  /**
   * Which tabs exist depends on the person: only designers and admins get "My designs". So the URL
   * carries a NAME, not an index — index 0 means designs for a designer and requests for a customer,
   * and a link shared between the two would land on the wrong tab.
   */
  protected readonly tabKeys = computed<readonly string[]>(() =>
    templateTabsFor(this.isDesigner()),
  );

  /**
   * Which tab is open, read from the live URL rather than held here. A swipe between these tabs
   * changes only the query string, so a value stored at construction would never move.
   */
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly selectedTab = computed(() =>
    Math.max(0, this.tabKeys().indexOf(this.params().get('tab') ?? '')),
  );

  /** Mirrors the tab into ?tab=… so a refresh, a back button or a shared link all land where you were. */
  protected onTabChange(index: number): void {
    const key = this.tabKeys()[index];
    if (!key) return;
    this.router.navigate([], {
      relativeTo: this.route,
      // The first tab is spelt as no tab at all, the way the inbox and the account page write theirs
      // — one URL per screen, however you arrived at it.
      queryParams: { tab: index === 0 ? null : key },
      queryParamsHandling: 'merge',
      // A tab switch isn't a navigation someone wants to walk back through one by one.
      replaceUrl: true,
    });
  }

  // ----- Drafts ---------------------------------------------------------------------------------
  /**
   * Invitations started but never sent. They were only reachable by holding on to the create-flow
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
        // Only unsent invitations belong here; anything sent is the dashboard's job, and an event
        // that is only a photo bucket has no invitation to finish.
        this.drafts.set((list ?? []).filter((c) => c.status === 'Draft' && !c.mediaOnly));
        this.draftsLoading.set(false);
      },
      error: () => this.draftsLoading.set(false),
    });
  }

  /** Back to the step it was left on (the server works that out), as the events list does. */
  protected resumeDraft(draft: MyCampaign): void {
    this.router.navigate(draft.resumeStep ? ['/create', draft.id, draft.resumeStep] : ['/dashboard', draft.id]);
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

  // ----- Delete ---------------------------------------------------------------------------

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

  /** What this person has asked for. The designs made for them are listed beside it as templates. */
  protected readonly inquiries = signal<MyRequest[]>([]);

  private loadInquiries(): void {
    this.api.myRequests().subscribe({
      next: (list) => this.inquiries.set(list),
      // A designer with no customer-side history simply has none; nothing to report.
      error: () => this.inquiries.set([]),
    });
  }

  private loadRequests(): void {
    this.requestsLoading.set(true);
    this.loadInquiries();
    this.api.myDedicatedTemplates().subscribe({
      next: (list) => {
        this.requests.set(list);
        this.requestsLoading.set(false);
      },
      error: () => this.requestsLoading.set(false),
    });
  }
}

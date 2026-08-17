import { DecimalPipe } from '@angular/common';
import { UiStatus } from 'ui';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiFileUpload, UiFormField, UiInput, UiSelect, UiTextarea } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { UiToastService } from 'ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import {
  DesignerCommission,
  DesignerTemplate,
  TemplateScanResult,
  TemplateTypeDto,
} from '../../shared/utils/types/api.types';

/**
 * A designer's home: the submissions they've sent and the form to send another. The form's "Check"
 * button dry-runs the same scan the submit endpoint runs, so a designer sees exactly what we
 * detected — and what we'd reject — before committing.
 */
@Component({
  selector: 'app-designer-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, ReactiveFormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState,
    UiFileUpload, UiFormField, UiInput, UiSelect, UiTextarea, UiSpinner, UiText,
  ],
  templateUrl: './designer-dashboard.component.html',
  styleUrl: './designer-dashboard.component.scss',
})
export class DesignerDashboardComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(UiToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly designer = this.session.account;
  protected readonly loading = signal(true);
  protected readonly submissions = signal<DesignerTemplate[]>([]);
  protected readonly categories = signal<{ label: string; value: string }[]>([]);

  protected readonly indexFile = signal<File | null>(null);
  protected readonly previewFile = signal<File | null>(null);
  protected readonly scan = signal<TemplateScanResult | null>(null);
  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);

  /** The submission being revised, if any — set by "Revise"/"Submit an update" on a card. */
  protected readonly revising = signal<DesignerTemplate | null>(null);

  /** Requests an admin handed to this designer, and the one they're answering with this submission. */
  protected readonly commissions = signal<DesignerCommission[]>([]);
  protected readonly answering = signal<DesignerCommission | null>(null);
  /** Which published commission is mid-release, if any. */
  protected readonly releasingId = signal<string | null>(null);

  /**
   * An update to an ALREADY-PUBLISHED template is a brand-new submission carrying the published
   * template's id, not an edit of the old row — that's what sends it back through review before it
   * replaces anything live.
   */
  protected readonly updatingPublished = computed(() => this.revising()?.status === 'Published');

  protected readonly canSubmit = computed(
    () => !!this.indexFile() && !!this.previewFile() && this.form.valid,
  );

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    category: this.fb.control('', Validators.required),
    description: this.fb.control(''),
  });

  constructor() {
    this.load();
    this.api.listMyCommissions().subscribe({
      // Only work actually HANDED OVER can be answered — a request that merely named this designer
      // has no agreed price yet and the server would refuse the submission.
      next: (list) => {
        const open = list.filter((c) => c.assigned && !c.templateIssued);
        this.commissions.set(open);
        // Arriving from the requests page with one already chosen.
        const wanted = this.route.snapshot.queryParamMap.get('commission');
        const match = wanted ? open.find((c) => c.inquiryId === wanted) : undefined;
        if (match) this.answer(match);
      },
      error: () => this.commissions.set([]),
    });
    this.api.listTemplateTypes().subscribe({
      next: (types: TemplateTypeDto[]) =>
        this.categories.set(types.map((t) => ({ label: t.name, value: t.name }))),
      error: () => this.categories.set([]),
    });
  }

  /**
   * The designer's half of the two-party consent. A commissioned template only reaches the public
   * gallery — and only starts earning its per-use fee — once the person who commissioned it agrees
   * too, so this records one side and nothing more.
   */
  protected release(submission: DesignerTemplate): void {
    const templateId = submission.publishedTemplateId;
    if (!templateId) return;

    this.releasingId.set(submission.id);
    this.api.releaseAsDesigner(templateId).subscribe({
      next: (release) => {
        this.releasingId.set(null);
        this.toast.success(
          release.isPublic
            ? 'Released — it’s in the public gallery now.'
            : 'Noted. It goes public once the customer agrees too.',
        );
        this.load();
      },
      error: () => this.releasingId.set(null),
    });
  }

  protected signOut(): void {
    this.session.clear();
    void this.router.navigate(['/']);
  }

  protected tone(status: string): UiStatus {
    switch (status) {
      case 'Published':
        return 'success';
      case 'Rejected':
        return 'danger';
      case 'Submitted':
      case 'InReview':
        return 'warning';
      case 'Draft':
        return 'neutral';
      default:
        return 'primary';
    }
  }

  protected onIndexPicked(files: File[]): void {
    this.indexFile.set(files[0] ?? null);
    this.scan.set(null); // a new file invalidates the previous check
  }

  protected onPreviewPicked(files: File[]): void {
    this.previewFile.set(files[0] ?? null);
  }

  /** Dry-run the scan. Nothing is created — this only reports what we'd do. */
  protected check(): void {
    const file = this.indexFile();
    if (!file) return;

    this.scanning.set(true);
    const form = new FormData();
    form.append('index', file, file.name);
    this.api.scanTemplate(form).subscribe({
      next: (result) => {
        this.scan.set(result);
        this.scanning.set(false);
      },
      error: () => this.scanning.set(false),
    });
  }

  /** Starts a submission that answers a commission — the brief pre-fills what it can. */
  protected answer(commission: DesignerCommission): void {
    this.answering.set(commission);
    this.revising.set(null);
    this.form.patchValue({ category: commission.occasion });
    this.scan.set(null);
    this.indexFile.set(null);
    this.previewFile.set(null);
  }

  protected cancelAnswer(): void {
    this.answering.set(null);
    this.form.reset();
  }

  protected revise(submission: DesignerTemplate): void {
    this.revising.set(submission);
    this.form.patchValue({
      name: submission.name,
      category: submission.category,
      description: submission.description,
    });
    this.scan.set(null);
    this.indexFile.set(null);
    this.previewFile.set(null);
  }

  protected cancelRevise(): void {
    this.revising.set(null);
    this.form.reset();
    this.indexFile.set(null);
    this.previewFile.set(null);
    this.scan.set(null);
  }

  protected submit(): void {
    const index = this.indexFile();
    const preview = this.previewFile();
    if (this.form.invalid || !index || !preview) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const form = new FormData();
    form.append('name', value.name);
    form.append('category', value.category);
    form.append('description', value.description);
    form.append('index', index, index.name);
    form.append('preview', preview, preview.name);

    // Answering a commission: the server reads the requester and the agreed price off the inquiry,
    // so all we send is which one this is for.
    const commission = this.answering();
    if (commission) form.append('commissionInquiryId', commission.inquiryId);

    const revising = this.revising();
    if (revising && this.updatingPublished() && revising.publishedTemplateId) {
      form.append('publishedTemplateId', revising.publishedTemplateId);
    }

    this.submitting.set(true);
    const request$ =
      revising && !this.updatingPublished()
        ? this.api.resubmitTemplate(revising.id, form)
        : this.api.submitTemplate(form);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Sent for review — we’ll let you know the outcome.');
        this.answering.set(null);
        this.cancelRevise();
        this.load();
      },
      error: () => this.submitting.set(false),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listMySubmissions().subscribe({
      next: (list) => {
        this.submissions.set(list);
        this.loading.set(false);
        this.openRevisionFromQuery(list);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * "Edit" on the templates table lands here with the PUBLISHED template's id. The submissions this
   * page works in are the review rows behind it, so match on what they published.
   */
  private openRevisionFromQuery(list: DesignerTemplate[]): void {
    const wanted = this.route.snapshot.queryParamMap.get('revise');
    if (!wanted || this.revising()) return;
    const match = list.find((s) => s.publishedTemplateId === wanted) ?? list.find((s) => s.id === wanted);
    if (match) this.revise(match);
  }
}

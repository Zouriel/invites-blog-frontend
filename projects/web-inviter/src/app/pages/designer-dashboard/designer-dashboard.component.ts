import { DecimalPipe } from '@angular/common';
import { UiStatus } from 'ui';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
import { DesignerStore } from '../../shared/services/designer.store';
import {
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
    DecimalPipe, ReactiveFormsModule, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState,
    UiFileUpload, UiFormField, UiInput, UiSelect, UiTextarea, UiSpinner, UiText,
  ],
  templateUrl: './designer-dashboard.component.html',
  styleUrl: './designer-dashboard.component.scss',
})
export class DesignerDashboardComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(DesignerStore);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly designer = this.store.designer;
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
    this.api.listTemplateTypes().subscribe({
      next: (types: TemplateTypeDto[]) =>
        this.categories.set(types.map((t) => ({ label: t.name, value: t.name }))),
      error: () => this.categories.set([]),
    });
  }

  protected signOut(): void {
    this.store.clear();
    void this.router.navigate(['/designer/login']);
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
      },
      error: () => this.loading.set(false),
    });
  }
}

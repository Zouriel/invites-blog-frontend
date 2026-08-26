import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import {
  UiCheckbox,
  UiFileUpload,
  UiFormField,
  UiInput,
  UiNumberInput,
  UiSelect,
  UiTextarea,
} from '@zouriel/ui/form';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { AdminDesigner, InquiryDetail } from '../../shared/utils/types/api.types';

/** Admin inquiry detail: consult (colors/references/notes + attended) and issue the dedicated template. */
@Component({
  selector: 'app-admin-inquiry-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    UiAlert,
    UiBadge,
    UiButton,
    UiCard,
    UiText,
    UiSkeleton,
    UiCheckbox,
    UiFileUpload,
    UiFormField,
    UiInput,
    UiNumberInput,
    UiSelect,
    UiTextarea,
  ],
  templateUrl: './admin-inquiry-detail.component.html',
  styleUrl: './admin-inquiry-detail.component.scss',
})
export class AdminInquiryDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly toasts = inject(UiToastService);

  readonly id = input.required<string>();

  protected readonly inquiry = signal<InquiryDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly issuing = signal(false);
  protected readonly assigning = signal(false);
  /** Designers this request can be handed to. */
  protected readonly designers = signal<AdminDesigner[]>([]);
  protected readonly designerOptions = computed(() => [
    { label: 'Nobody yet', value: '' },
    ...this.designers().map((d) => ({ label: `${d.displayName} (${d.email})`, value: d.userId })),
  ]);

  protected readonly commissionForm = this.fb.group({
    designerUserId: this.fb.control(''),
    commissionPrice: this.fb.control<number | null>(null),
    usagePrice: this.fb.control<number | null>(null),
  });

  protected readonly consultForm = this.fb.group({
    colors: this.fb.control(''),
    references: this.fb.control(''),
    notes: this.fb.control(''),
    hasAttended: this.fb.control(false),
  });

  protected readonly issueForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    slug: this.fb.control('', Validators.required),
    category: this.fb.control('', Validators.required),
    version: this.fb.control('1.0.0'),
    description: this.fb.control(''),
  });

  protected readonly indexFile = signal<File | null>(null);
  protected readonly indexError = signal(false);

  // meta.json shortcut (same as the admin upload form)
  protected readonly metaControl = this.fb.control('');
  protected readonly metaError = signal('');
  protected readonly metaApplied = signal(false);

  ngOnInit(): void {
    this.api.getInquiry(this.id()).subscribe({
      next: (q) => {
        this.inquiry.set(q);
        this.consultForm.patchValue({
          colors: q.colors ?? '',
          references: q.references ?? '',
          notes: q.notes ?? '',
          hasAttended: q.hasAttended,
        });
        // Prefill the issue form from the inquiry to save typing.
        this.issueForm.patchValue({
          name: q.name,
          slug: this.slugify(q.name),
          category: q.occasion,
        });
        this.commissionForm.patchValue({
          // Not yet handed over: start from whoever the customer asked for, so the common case is
          // one click. Still fully editable.
          designerUserId: q.assignedDesignerUserId ?? q.requestedDesignerUserId ?? '',
          commissionPrice: q.commissionPrice,
          usagePrice: q.usagePrice,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Designers this request can be handed to. Best-effort — the rest of the page works without it.
    this.api.listDesigners(1, '', 100).subscribe({
      next: (page) => this.designers.set(page.items.filter((d) => d.isActive)),
      error: () => this.designers.set([]),
    });
  }

  /**
   * Hands this request to a designer at an agreed price. The designer then sees it as a commission
   * to build against, and the price rides along to the template they submit — they can't set it
   * themselves.
   */
  protected assignCommission(): void {
    const v = this.commissionForm.getRawValue();
    this.assigning.set(true);
    this.api
      .assignCommission(
        this.id(),
        v.designerUserId || null,
        this.money(v.commissionPrice),
        this.money(v.usagePrice),
      )
      .subscribe({
        next: (updated) => {
          this.inquiry.set(updated);
          this.assigning.set(false);
          this.toasts.success(
            updated.assignedDesignerName
              ? `Handed to ${updated.assignedDesignerName}.`
              : 'Commission cleared.',
          );
        },
        error: () => this.assigning.set(false),
      });
  }

  private money(raw: number | null): number | null {
    return raw != null && Number.isFinite(raw) && raw >= 0 ? raw : null;
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  protected saveConsult(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const v = this.consultForm.getRawValue();
    this.api
      .updateInquiry(this.id(), {
        colors: v.colors.trim() || null,
        references: v.references.trim() || null,
        notes: v.notes.trim() || null,
        hasAttended: v.hasAttended,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toasts.success('Saved.');
          const q = this.inquiry();
          if (q) this.inquiry.set({ ...q, hasAttended: v.hasAttended });
        },
        error: () => this.saving.set(false),
      });
  }

  protected onFiles(files: File[]): void {
    const file = files[0] ?? null;
    this.indexFile.set(file);
    if (file) this.indexError.set(false);
  }

  protected applyMeta(): void {
    this.metaError.set('');
    this.metaApplied.set(false);
    const raw = (this.metaControl.value ?? '').trim();
    if (!raw) {
      this.metaError.set('Paste a meta.json first.');
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      this.metaError.set("That doesn't look like valid JSON.");
      return;
    }
    const pick = (key: string): string => {
      const match = Object.keys(parsed).find((k) => k.toLowerCase() === key.toLowerCase());
      const val = match ? parsed[match] : undefined;
      return typeof val === 'string' ? val.trim() : val == null ? '' : String(val);
    };
    const patch: Record<string, string> = {};
    for (const key of ['name', 'slug', 'category', 'version', 'description'] as const) {
      const value = pick(key);
      if (value) patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      this.metaError.set('No recognizable fields (name, slug, category, version, description).');
      return;
    }
    this.issueForm.patchValue(patch);
    this.metaApplied.set(true);
  }

  protected issue(): void {
    const file = this.indexFile();
    if (this.issueForm.invalid || !file) {
      this.issueForm.markAllAsTouched();
      this.indexError.set(!file);
      return;
    }
    if (this.issuing()) return;
    const v = this.issueForm.getRawValue();
    const data = new FormData();
    data.append('name', v.name);
    data.append('slug', v.slug);
    data.append('category', v.category);
    if (v.version) data.append('version', v.version);
    if (v.description) data.append('description', v.description);
    data.append('index', file, file.name);

    this.issuing.set(true);
    this.api.issueInquiryTemplate(this.id(), data).subscribe({
      next: (res) => {
        this.issuing.set(false);
        this.toasts.success(
          res.emailed
            ? 'Template issued and emailed to the customer.'
            : 'Template issued (email could not be sent).',
        );
        const q = this.inquiry();
        if (q) this.inquiry.set({ ...q, templateIssued: true, issuedTemplateId: res.templateId });
      },
      error: () => this.issuing.set(false),
    });
  }

  protected back(): void {
    this.router.navigate(['/admin/inquiries']);
  }
}

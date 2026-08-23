import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiResult } from '@zouriel/ui/feedback';
import { UiText } from '@zouriel/ui/text';
import { UiFileUpload, UiFormField, UiInput, UiSelect, UiSelectOption, UiTextarea } from '@zouriel/ui/form';
import { ApiService } from '../../shared/api/api.service';
import { TemplateTypeDto, TemplateUploadResult } from '../../shared/utils/types/api.types';

/** Admin template upload — always Public (dedicated templates are issued via the inquiry flow). */
@Component({
  selector: 'app-admin-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiAlert,
    UiBadge,
    UiButton,
    UiCard,
    UiResult,
    UiText,
    UiFileUpload,
    UiFormField,
    UiInput,
    UiSelect,
    UiTextarea,
  ],
  templateUrl: './admin-upload.component.html',
  styleUrl: './admin-upload.component.scss',
})
export class AdminUploadComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  /** Set when we arrived from "Edit" on the templates table, so the page can say what it's editing. */
  protected readonly editing = signal<string | null>(null);

  protected readonly uploading = signal(false);
  protected readonly result = signal<TemplateUploadResult | null>(null);

  protected readonly indexFile = signal<File | null>(null);
  protected readonly indexError = signal(false);
  /** Optional static card image — without one the gallery falls back to rendering the live page. */
  protected readonly previewFile = signal<File | null>(null);

  private readonly types = signal<TemplateTypeDto[]>([]);
  protected readonly typeOptions = computed<UiSelectOption[]>(() =>
    this.types().map((t) => ({ label: t.name, value: t.name })),
  );

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    slug: this.fb.control('', Validators.required),
    category: this.fb.control('', Validators.required),
    version: this.fb.control('1.0.0'),
    description: this.fb.control(''),
  });

  // Optional shortcut: paste a template's meta.json to fill the details.
  protected readonly metaControl = this.fb.control('');
  protected readonly metaError = signal('');
  protected readonly metaApplied = signal(false);

  constructor() {
    this.api.listTemplateTypes().subscribe({ next: (t) => this.types.set(t) });

    // "Edit" on the templates table sends the template's id. Load what it already is — including its
    // current index.html — so an edit is a real edit rather than a blank upload form.
    const id = this.route.snapshot.queryParamMap.get('template');
    if (id) this.loadForEdit(id);
  }

  /**
   * Publishing again under the SAME SLUG supersedes the previous version, so an edit is an upload
   * that starts from what's already there.
   */
  private loadForEdit(id: string): void {
    this.api.myTemplates().subscribe({
      next: (page) => {
        const row = page.templates.find((t) => t.id === id);
        if (!row) return;
        this.editing.set(row.name);
        this.form.patchValue({
          name: row.name,
          slug: row.slug,
          category: row.category,
          version: row.version,
        });
      },
    });
    this.api.templateSource(id).subscribe({
      next: (html) => {
        // Seed the file input with the current source so the form is complete on arrival; dropping a
        // new file replaces it as usual.
        this.indexFile.set(new File([html], 'index.html', { type: 'text/html' }));
        this.indexError.set(false);
      },
    });
  }

  protected controlError(control: 'name' | 'slug' | 'category'): string | undefined {
    const c = this.form.controls[control];
    return !c.touched || c.valid ? undefined : 'This field is required.';
  }

  protected onFiles(files: File[]): void {
    const file = files[0] ?? null;
    this.indexFile.set(file);
    if (file) this.indexError.set(false);
  }

  protected onPreviewFiles(files: File[]): void {
    this.previewFile.set(files[0] ?? null);
  }

  protected preview(packageUrl: string): void {
    window.open(packageUrl + 'index.html', '_blank', 'noopener');
  }

  protected submit(): void {
    const index = this.indexFile();
    if (this.form.invalid || !index) {
      this.form.markAllAsTouched();
      this.indexError.set(!index);
      return;
    }
    const values = this.form.getRawValue();
    const data = new FormData();
    data.append('name', values.name);
    data.append('slug', values.slug);
    data.append('category', values.category);
    if (values.version) data.append('version', values.version);
    if (values.description) data.append('description', values.description);
    data.append('index', index, index.name);
    const previewImage = this.previewFile();
    if (previewImage) data.append('preview', previewImage, previewImage.name);
    // Uploads are always Public — dedicated templates are issued from an inquiry.

    this.uploading.set(true);
    this.result.set(null);
    this.api.uploadTemplate(data).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.result.set(res);
        this.form.reset({ version: '1.0.0' });
        this.indexFile.set(null);
        this.previewFile.set(null);
        this.metaApplied.set(false);
        this.metaControl.reset();
      },
      error: () => this.uploading.set(false),
    });
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
      const v = match ? parsed[match] : undefined;
      return typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
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
    this.form.patchValue(patch);
    this.metaApplied.set(true);
  }
}

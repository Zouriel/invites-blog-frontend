import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiResult } from 'ui/feedback';
import { UiText } from 'ui/text';
import { UiFileUpload, UiFormField, UiInput, UiSelect, UiSelectOption, UiTextarea } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { TemplateTypeDto, TemplateUploadResult } from '../../shared/utils/types/api.types';

/** Admin template upload — always Public (dedicated templates are issued via the inquiry flow). */
@Component({
  selector: 'app-admin-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
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

  protected readonly uploading = signal(false);
  protected readonly result = signal<TemplateUploadResult | null>(null);

  protected readonly indexFile = signal<File | null>(null);
  protected readonly indexError = signal(false);

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
    // Uploads are always Public — dedicated templates are issued from an inquiry.

    this.uploading.set(true);
    this.result.set(null);
    this.api.uploadTemplate(data).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.result.set(res);
        this.form.reset({ version: '1.0.0' });
        this.indexFile.set(null);
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

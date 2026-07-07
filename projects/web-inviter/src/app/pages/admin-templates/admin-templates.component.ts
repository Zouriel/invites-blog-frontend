import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiResult, UiEmptyState } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { UiFormField, UiInput, UiTextarea } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { AdminStore } from '../../shared/services/admin.store';
import { Template, TemplateUploadResult } from '../../shared/utils/types/api.types';

@Component({
  selector: 'app-admin-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiBadge,
    UiButton,
    UiCard,
    UiResult,
    UiEmptyState,
    UiSpinner,
    UiText,
    UiFormField,
    UiInput,
    UiTextarea,
  ],
  templateUrl: './admin-templates.component.html',
  styleUrl: './admin-templates.component.scss',
})
export class AdminTemplatesComponent {
  private readonly api = inject(ApiService);
  private readonly admin = inject(AdminStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly uploading = signal(false);
  protected readonly result = signal<TemplateUploadResult | null>(null);

  protected readonly indexFile = signal<File | null>(null);
  protected readonly stylesFile = signal<File | null>(null);
  protected readonly indexError = signal(false);

  protected readonly templates = signal<Template[]>([]);
  protected readonly listLoading = signal(true);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    slug: this.fb.control('', Validators.required),
    category: this.fb.control('', Validators.required),
    version: this.fb.control('1.0.0'),
    description: this.fb.control(''),
  });

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.listLoading.set(true);
    this.api.listTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.items);
        this.listLoading.set(false);
      },
      error: () => this.listLoading.set(false),
    });
  }

  protected onIndexPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.indexFile.set(file);
    if (file) {
      this.indexError.set(false);
    }
  }

  protected onStylesPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.stylesFile.set(input.files?.[0] ?? null);
  }

  protected controlError(control: 'name' | 'slug' | 'category'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) {
      return undefined;
    }
    return 'This field is required.';
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
    if (values.version) {
      data.append('version', values.version);
    }
    if (values.description) {
      data.append('description', values.description);
    }
    data.append('index', index, index.name);
    const styles = this.stylesFile();
    if (styles) {
      data.append('styles', styles, styles.name);
    }

    this.uploading.set(true);
    this.result.set(null);
    this.api.uploadTemplate(data).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.result.set(res);
        this.form.reset({ version: '1.0.0' });
        this.indexFile.set(null);
        this.stylesFile.set(null);
        this.loadTemplates();
      },
      error: () => this.uploading.set(false),
    });
  }

  protected logout(): void {
    this.admin.clear();
    this.router.navigate(['/admin/login']);
  }
}

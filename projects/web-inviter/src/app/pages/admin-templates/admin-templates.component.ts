import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiResult, UiEmptyState } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import {
  UiFormField,
  UiInput,
  UiRadioGroup,
  UiRadioOption,
  UiSelect,
  UiSelectOption,
  UiTextarea,
} from 'ui/form';
import { UiToastService } from 'ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { AdminStore } from '../../shared/services/admin.store';
import {
  AdminTemplate,
  TemplateTypeDto,
  TemplateUploadResult,
} from '../../shared/utils/types/api.types';

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
    UiRadioGroup,
    UiSelect,
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
  private readonly toasts = inject(UiToastService);

  protected readonly uploading = signal(false);
  protected readonly result = signal<TemplateUploadResult | null>(null);

  protected readonly indexFile = signal<File | null>(null);
  protected readonly indexError = signal(false);

  protected readonly templates = signal<AdminTemplate[]>([]);
  protected readonly listLoading = signal(true);
  protected readonly deletingId = signal<string | null>(null);

  /** Types shown in the upload dropdown (active only). */
  protected readonly types = signal<TemplateTypeDto[]>([]);
  protected readonly typeOptions = computed<UiSelectOption[]>(() =>
    this.types().map((t) => ({ label: t.name, value: t.name })),
  );

  /** Full type list (incl. inactive) for the management panel. */
  protected readonly adminTypes = signal<TemplateTypeDto[]>([]);
  protected readonly typesLoading = signal(true);
  protected readonly addingType = signal(false);

  /** Visibility toggle: Public (gallery) vs Dedicated (reserved for one requester). */
  protected readonly visibilityOptions: UiRadioOption[] = [
    { label: 'Public — appears in the gallery', value: 'Public' },
    { label: 'Dedicated — reserved for one requester', value: 'Dedicated' },
  ];

  protected readonly assignedEmailError = signal<string | undefined>(undefined);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    slug: this.fb.control('', Validators.required),
    category: this.fb.control('', Validators.required),
    version: this.fb.control('1.0.0'),
    description: this.fb.control(''),
    visibility: this.fb.control<'Public' | 'Dedicated'>('Public', Validators.required),
    assignedEmail: this.fb.control(''),
  });

  /** Reactive mirror of the visibility control, so the template can reveal the email field. */
  private readonly visibility = toSignal(this.form.controls.visibility.valueChanges, {
    initialValue: this.form.controls.visibility.value,
  });
  protected readonly isDedicated = computed(() => this.visibility() === 'Dedicated');

  protected readonly typeForm = this.fb.group({
    name: this.fb.control('', Validators.required),
  });

  constructor() {
    this.loadTemplates();
    this.loadTypes();
  }

  private loadTemplates(): void {
    this.listLoading.set(true);
    this.api.listAdminTemplates().subscribe({
      next: (items) => {
        this.templates.set(items);
        this.listLoading.set(false);
      },
      error: () => this.listLoading.set(false),
    });
  }

  protected removeTemplate(t: AdminTemplate): void {
    if (this.deletingId()) return;
    const warn =
      t.campaignCount > 0
        ? `“${t.name}” is used by ${t.campaignCount} campaign(s). It will be deactivated (hidden from the gallery) so existing invites keep working. Continue?`
        : `Delete “${t.name}” permanently? This can't be undone.`;
    if (!confirm(warn)) return;

    this.deletingId.set(t.id);
    this.api.deleteTemplate(t.id).subscribe({
      next: (res) => {
        this.deletingId.set(null);
        this.toasts.success(
          res.deactivated ? `“${t.name}” was deactivated.` : `“${t.name}” was deleted.`,
        );
        this.loadTemplates();
      },
      error: () => this.deletingId.set(null),
    });
  }

  private loadTypes(): void {
    this.api.listTemplateTypes().subscribe({
      next: (types) => this.types.set(types),
    });
    this.typesLoading.set(true);
    this.api.listAdminTemplateTypes().subscribe({
      next: (types) => {
        this.adminTypes.set(types);
        this.typesLoading.set(false);
      },
      error: () => this.typesLoading.set(false),
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
    const values = this.form.getRawValue();
    const dedicated = values.visibility === 'Dedicated';
    const assignedEmail = values.assignedEmail.trim();

    // Dedicated templates must name the requester they're reserved for.
    let emailError: string | undefined;
    if (dedicated && !assignedEmail) {
      emailError = 'An assigned email is required for dedicated templates.';
    } else if (dedicated && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedEmail)) {
      emailError = 'Enter a valid email address.';
    }
    this.assignedEmailError.set(emailError);

    if (this.form.invalid || !index || emailError) {
      this.form.markAllAsTouched();
      this.indexError.set(!index);
      return;
    }

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
    data.append('visibility', values.visibility);
    if (dedicated) {
      data.append('assignedEmail', assignedEmail);
    }

    this.uploading.set(true);
    this.result.set(null);
    this.api.uploadTemplate(data).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.result.set(res);
        this.form.reset({ version: '1.0.0', visibility: 'Public' });
        this.assignedEmailError.set(undefined);
        this.indexFile.set(null);
        this.loadTemplates();
      },
      error: () => this.uploading.set(false),
    });
  }

  protected addType(): void {
    if (this.typeForm.invalid || this.addingType()) {
      this.typeForm.markAllAsTouched();
      return;
    }
    this.addingType.set(true);
    this.api.createTemplateType(this.typeForm.getRawValue().name.trim()).subscribe({
      next: () => {
        this.addingType.set(false);
        this.typeForm.reset();
        this.loadTypes();
      },
      error: () => this.addingType.set(false),
    });
  }

  protected removeType(id: string): void {
    this.api.deleteTemplateType(id).subscribe({
      next: () => this.loadTypes(),
    });
  }

  protected logout(): void {
    this.admin.clear();
    this.router.navigate(['/admin/login']);
  }
}

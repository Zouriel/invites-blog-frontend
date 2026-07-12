import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { TemplateTypeDto } from '../../shared/utils/types/api.types';

/** Admin template types — add, deactivate, paged + searchable. */
@Component({
  selector: 'app-admin-template-types',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiBadge,
    UiButton,
    UiCard,
    UiText,
    UiSpinner,
    UiEmptyState,
    UiFormField,
    UiInput,
  ],
  templateUrl: './admin-template-types.component.html',
  styleUrl: './admin-template-types.component.scss',
})
export class AdminTemplateTypesComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly types = signal<TemplateTypeDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly addingType = signal(false);

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  protected readonly typeForm = this.fb.group({
    name: this.fb.control('', Validators.required),
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listAdminTemplateTypes(this.page(), this.search()).subscribe({
      next: (p) => {
        this.types.set(p.items);
        this.totalPages.set(p.totalPages);
        this.totalCount.set(p.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  protected prev(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  protected next(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
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
        this.page.set(1);
        this.load();
      },
      error: () => this.addingType.set(false),
    });
  }

  protected removeType(id: string): void {
    this.api.deleteTemplateType(id).subscribe({ next: () => this.load() });
  }
}

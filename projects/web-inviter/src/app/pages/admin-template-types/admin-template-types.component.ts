import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSkeleton } from 'ui/skeleton';
import { UiEmptyState } from 'ui/feedback';
import { UiPagination } from 'ui/navigation';
import { UiFormField, UiInput, UiSearchInput } from 'ui/form';
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
    UiSkeleton,
    UiEmptyState,
    UiPagination,
    UiFormField,
    UiInput,
    UiSearchInput,
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

  protected readonly searchControl = this.fb.control('');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);
  protected readonly skeletons = Array.from({ length: 5 });

  protected readonly typeForm = this.fb.group({
    name: this.fb.control('', Validators.required),
  });

  constructor() {
    this.searchControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listAdminTemplateTypes(this.page(), this.searchControl.value).subscribe({
      next: (p) => {
        this.types.set(p.items);
        this.totalPages.set(p.totalPages);
        this.totalCount.set(p.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
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

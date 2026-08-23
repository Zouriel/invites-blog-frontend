import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiPagination } from '@zouriel/ui/navigation';
import { UiFormField, UiInput, UiSearchInput } from '@zouriel/ui/form';
import { UiConfirmDialog } from '@zouriel/ui/dialog';
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
    UiConfirmDialog,
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

  /** The type awaiting a yes/no before being deactivated. */
  protected readonly pendingRemove = signal<TemplateTypeDto | null>(null);
  protected readonly removeMessage = computed(() => {
    const t = this.pendingRemove();
    if (!t) return '';
    return `“${t.name}” will disappear from the upload picker and the public gallery filter.`;
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

  /** Asks first — once deactivated, a type disappears from the upload picker with no way back here. */
  protected removeType(type: TemplateTypeDto): void {
    this.pendingRemove.set(type);
  }

  protected confirmRemove(): void {
    const type = this.pendingRemove();
    this.pendingRemove.set(null);
    if (!type) return;
    this.api.deleteTemplateType(type.id).subscribe({ next: () => this.load() });
  }
}

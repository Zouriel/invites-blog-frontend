import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiCheckbox, UiFormField, UiInput, UiTextarea } from '@zouriel/ui/form';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { InquiryDetail } from '../../shared/utils/types/api.types';

/**
 * Admin inquiry detail: who asked and what for, and the consultation notes. The invitation itself is
 * made in the designer and published "For someone" to the customer's email.
 */
@Component({
  selector: 'app-admin-inquiry-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, ReactiveFormsModule, RouterLink, HugeiconsIconComponent,
    UiBadge, UiButton, UiCard, UiText, UiSkeleton, UiCheckbox, UiFormField, UiInput, UiTextarea,
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

  protected readonly backIcon = ArrowLeft01Icon;
  protected readonly inquiry = signal<InquiryDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly consultForm = this.fb.group({
    colors: this.fb.control(''),
    references: this.fb.control(''),
    notes: this.fb.control(''),
    hasAttended: this.fb.control(false),
  });

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
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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

  protected back(): void {
    this.router.navigate(['/admin/inquiries']);
  }
}

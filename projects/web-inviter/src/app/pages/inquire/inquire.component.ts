import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiInput, UiSelect, UiTextarea, UiFormField } from 'ui/form';
import { UiResult } from 'ui/feedback';
import { ApiService } from '../../shared/api/api.service';
import { PublicDesigner } from '../../shared/utils/types/api.types';

/** Public "Start an inquiry" form — captures a custom-invitation request as a Customer/Inquiry record. */
@Component({
  selector: 'app-inquire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, UiButton, UiCard, UiText, UiInput, UiSelect, UiTextarea,
    UiFormField, UiResult,
  ],
  templateUrl: './inquire.component.html',
  styleUrl: './inquire.component.scss',
})
export class InquireComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ApiService);

  protected readonly submitting = signal(false);
  protected readonly done = signal(false);

  /**
   * Who the request should reach. Empty means the invites.blog team picks someone — the old
   * behaviour, and still the right default for anyone who hasn't a designer in mind.
   */
  protected readonly designers = signal<{ label: string; value: string }[]>([]);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control('', [Validators.required, Validators.email]),
    occasion: this.fb.control('', Validators.required),
    message: this.fb.control('', Validators.required),
    designerUserId: this.fb.control(''),
  });

  constructor() {
    this.api.listPublicDesigners().subscribe({
      next: (list: PublicDesigner[]) =>
        this.designers.set([
          { label: 'No preference — let the invites.blog team choose', value: '' },
          ...list.map((d) => ({
            label: `${d.displayName} · ${d.publishedTemplates} template${d.publishedTemplates === 1 ? '' : 's'}`,
            value: d.userId,
          })),
        ]),
      // A designer list we couldn't load must not block the form; the request still reaches us.
      error: () => this.designers.set([]),
    });
  }

  protected error(control: 'name' | 'email' | 'occasion' | 'message'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) return undefined;
    if (control === 'email') return 'Enter a valid email address.';
    return 'This field is required.';
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.api
      .submitInquiry({
        name: v.name.trim(),
        email: v.email.trim(),
        occasion: v.occasion.trim(),
        message: v.message.trim(),
        requestedDesignerUserId: v.designerUserId || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.done.set(true);
        },
        error: () => this.submitting.set(false),
      });
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiInput, UiTextarea, UiFormField } from 'ui/form';
import { UiResult } from 'ui/feedback';
import { ApiService } from '../../shared/api/api.service';

/** Public "Start an inquiry" form — captures a custom-invitation request as a Customer/Inquiry record. */
@Component({
  selector: 'app-inquire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiCard, UiText, UiInput, UiTextarea, UiFormField, UiResult],
  templateUrl: './inquire.component.html',
  styleUrl: './inquire.component.scss',
})
export class InquireComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ApiService);

  protected readonly submitting = signal(false);
  protected readonly done = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control('', [Validators.required, Validators.email]),
    occasion: this.fb.control('', Validators.required),
    message: this.fb.control('', Validators.required),
  });

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

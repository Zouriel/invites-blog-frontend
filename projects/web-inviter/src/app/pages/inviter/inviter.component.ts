import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiFormField, UiInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { InviterPayload } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

@Component({
  selector: 'app-inviter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiButton, UiCard, UiText, UiFormField, UiInput, WizardStepsComponent],
  templateUrl: './inviter.component.html',
  styleUrl: './inviter.component.scss',
})
export class InviterComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Inviter;

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    phone: this.fb.control('', Validators.required),
    email: this.fb.control('', [Validators.required, Validators.email]),
    organization: this.fb.control(''),
  });

  protected error(control: 'name' | 'phone' | 'email'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) {
      return undefined;
    }
    return control === 'email' && c.hasError('email') ? 'Enter a valid email.' : 'This field is required.';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const payload: InviterPayload = this.form.getRawValue();
    this.api.saveInviter(this.campaignId(), payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'delivery']);
      },
      error: () => this.saving.set(false),
    });
  }
}

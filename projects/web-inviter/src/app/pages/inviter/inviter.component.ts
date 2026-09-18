import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { InviterPayload } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { wizardStepEyebrow } from '../../shared/utils/constants/app.constants';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../../shared/icons/app-icons';

@Component({
  selector: 'app-inviter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, ReactiveFormsModule, UiButton, UiCard, UiText, UiFormField, UiInput, WizardStepsComponent],
  templateUrl: './inviter.component.html',
  styleUrl: './inviter.component.scss',
})
export class InviterComponent implements OnInit {
  protected readonly appIcons = APP_ICONS;
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly session = inject(SessionStore);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Inviter;
  protected readonly eyebrow = wizardStepEyebrow(WizardStepKey.Inviter);

  protected readonly saving = signal(false);

  // Name + email identify the host (email also carries the resume link); phone is optional.
  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    phone: this.fb.control(''),
    email: this.fb.control('', [Validators.required, Validators.email]),
    organization: this.fb.control(''),
  });

  /** What was saved on this step before; otherwise the signed-in account's own details. */
  ngOnInit(): void {
    const account = this.session.account();
    this.form.patchValue({
      name: account?.displayName ?? '',
      email: account?.email ?? '',
      phone: account?.phoneE164 ?? '',
    });
    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (s) => {
        if (!s.inviterEmail && !s.inviterName) return;
        this.form.patchValue({
          name: s.inviterName ?? '',
          email: s.inviterEmail ?? '',
          phone: s.inviterPhone ?? '',
          organization: s.inviterOrganization ?? '',
        });
      },
      error: () => {},
    });
  }

  protected error(control: 'name' | 'email'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) {
      return undefined;
    }
    if (control === 'name') {
      return 'Your name is required.';
    }
    return c.errors?.['required'] ? 'An email is required.' : 'Enter a valid email.';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const payload: InviterPayload = {
      name: v.name.trim() || undefined,
      phone: v.phone.trim() || undefined,
      email: v.email.trim() || undefined,
      organization: v.organization.trim() || undefined,
    };
    this.api.saveInviter(this.campaignId(), payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'photos']);
      },
      error: () => this.saving.set(false),
    });
  }
}

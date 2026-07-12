import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiCheckbox, UiFormField, UiTextarea } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DeliverySettings } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { DEFAULT_MESSAGE_TEMPLATE } from '../../shared/utils/constants/app.constants';

@Component({
  selector: 'app-delivery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiCheckbox,
    UiFormField,
    UiTextarea,
    WizardStepsComponent,
  ],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss',
})
export class DeliveryComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Delivery;

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    // Everyone gets the shareable link; optionally we also email it to the guest list.
    emailGuests: this.fb.control(false),
    messageTemplate: this.fb.control(DEFAULT_MESSAGE_TEMPLATE),
  });

  protected submit(): void {
    if (this.saving()) return;
    const raw = this.form.getRawValue();
    const settings: DeliverySettings = {
      channels: raw.emailGuests ? ['email', 'share'] : ['share'],
      fallbackChannel: null,
      messageTemplate: raw.messageTemplate,
    };
    this.saving.set(true);
    this.api.saveDeliverySettings(this.campaignId(), settings).subscribe({
      next: () => this.finalize(),
      error: () => this.saving.set(false),
    });
  }

  private finalize(): void {
    this.api.finalizeCampaign(this.campaignId()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'success'], {
          state: { shareLink: res.shareLink, emailed: res.emailed, guestCount: res.guestCount },
        });
      },
      error: () => this.saving.set(false),
    });
  }
}

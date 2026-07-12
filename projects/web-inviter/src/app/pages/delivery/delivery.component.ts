import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiFormField, UiTextarea, UiRadioGroup, type UiRadioOption } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DeliverySettings } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { DEFAULT_MESSAGE_TEMPLATE } from '../../shared/utils/constants/app.constants';

/** Each trigger option maps to a concrete channel walk (see the product delivery rule). */
type TriggerKey = 'viber-email' | 'email' | 'viber' | 'email-viber';

@Component({
  selector: 'app-delivery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiFormField,
    UiTextarea,
    UiRadioGroup,
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

  protected readonly triggerOptions: UiRadioOption[] = [
    { label: 'Viber first, email backup', value: 'viber-email' },
    { label: 'Email only', value: 'email' },
    { label: 'Viber only', value: 'viber' },
    { label: 'Email first, Viber backup', value: 'email-viber' },
  ];

  private readonly triggerMap: Record<TriggerKey, Pick<DeliverySettings, 'channels' | 'fallbackChannel'>> = {
    'viber-email': { channels: ['viber'], fallbackChannel: 'email' },
    email: { channels: ['email'], fallbackChannel: null },
    viber: { channels: ['viber'], fallbackChannel: null },
    'email-viber': { channels: ['email'], fallbackChannel: 'viber' },
  };

  protected readonly form = this.fb.group({
    trigger: this.fb.control<TriggerKey>('viber-email'),
    messageTemplate: this.fb.control(DEFAULT_MESSAGE_TEMPLATE),
  });

  protected submit(): void {
    if (this.saving()) return;
    const raw = this.form.getRawValue();
    const walk = this.triggerMap[raw.trigger] ?? this.triggerMap['viber-email'];
    const settings: DeliverySettings = {
      channels: walk.channels,
      fallbackChannel: walk.fallbackChannel,
      messageTemplate: raw.messageTemplate,
    };
    this.saving.set(true);
    this.api.saveDeliverySettings(this.campaignId(), settings).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'payment']);
      },
      error: () => this.saving.set(false),
    });
  }
}

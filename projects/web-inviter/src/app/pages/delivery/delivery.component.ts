import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiAlert } from 'ui/alert';
import { UiCheckbox, UiFormField, UiTextarea } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DeliverySettings } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { DELIVERY_CHANNELS, DEFAULT_MESSAGE_TEMPLATE } from '../../shared/utils/constants/app.constants';

@Component({
  selector: 'app-delivery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiAlert,
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
  protected readonly channels = DELIVERY_CHANNELS;

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    email: this.fb.control(true),
    link: this.fb.control(true),
    telegram: this.fb.control({ value: false, disabled: true }),
    whatsapp: this.fb.control({ value: false, disabled: true }),
    messageTemplate: this.fb.control(DEFAULT_MESSAGE_TEMPLATE),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly selectedCount = computed(() => {
    const v = this.value();
    return [v.email, v.link, v.telegram, v.whatsapp].filter(Boolean).length;
  });

  protected submit(): void {
    if (this.selectedCount() === 0 || this.saving()) {
      return;
    }
    const raw = this.form.getRawValue();
    const channels = this.channels
      .filter((c) => raw[c.key])
      .map((c) => c.key as string);
    const settings: DeliverySettings = {
      channels,
      fallbackChannel: 'email',
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

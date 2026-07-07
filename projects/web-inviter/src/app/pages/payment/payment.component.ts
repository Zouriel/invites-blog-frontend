import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { ApiService } from '../../shared/api/api.service';
import { Pricing } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

@Component({
  selector: 'app-payment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    UiButton,
    UiCard,
    UiText,
    UiSpinner,
    UiEmptyState,
    WizardStepsComponent,
  ],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
})
export class PaymentComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Payment;

  protected readonly pricing = signal<Pricing | null>(null);
  protected readonly loading = signal(true);
  protected readonly paying = signal(false);

  ngOnInit(): void {
    this.api.getPricing(this.campaignId()).subscribe({
      next: (p) => {
        this.pricing.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected pay(): void {
    this.paying.set(true);
    this.api.checkout(this.campaignId()).subscribe({
      next: (res) => {
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          this.paying.set(false);
        }
      },
      error: () => this.paying.set(false),
    });
  }
}

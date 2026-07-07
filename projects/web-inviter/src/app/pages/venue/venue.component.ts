import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiFormField, UiInput, UiTextarea } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { VenuePayload } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';

@Component({
  selector: 'app-venue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiFormField,
    UiInput,
    UiTextarea,
    WizardStepsComponent,
  ],
  templateUrl: './venue.component.html',
  styleUrl: './venue.component.scss',
})
export class VenueComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Venue;

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control(''),
    address: this.fb.control(''),
    city: this.fb.control(''),
    mapUrl: this.fb.control(''),
    notes: this.fb.control(''),
  });

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    const payload: VenuePayload = this.form.getRawValue();
    this.api.saveVenue(this.campaignId(), payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'inviter']);
      },
      error: () => this.saving.set(false),
    });
  }
}

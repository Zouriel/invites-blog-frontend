import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiAlert } from 'ui/alert';
import { UiFileUpload, UiFormField, UiSelect } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { UploadResult } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { UploadSummaryComponent } from '../../features/wizard/upload-summary.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { COUNTRY_OPTIONS } from '../../shared/utils/constants/app.constants';

@Component({
  selector: 'app-guests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiButton,
    UiCard,
    UiText,
    UiAlert,
    UiFileUpload,
    UiFormField,
    UiSelect,
    WizardStepsComponent,
    UploadSummaryComponent,
  ],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
})
export class GuestsComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Guests;
  protected readonly countryOptions = COUNTRY_OPTIONS;

  protected readonly countryControl = this.fb.control('MV');
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly result = signal<UploadResult | null>(null);

  protected onFiles(files: File[]): void {
    this.file.set(files[0] ?? null);
  }

  protected upload(): void {
    const f = this.file();
    if (!f || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.api.uploadGuests(this.campaignId(), f, this.countryControl.value).subscribe({
      next: (res) => {
        this.result.set(res);
        this.uploading.set(false);
        sessionStorage.setItem(`ib_upload_${this.campaignId()}`, JSON.stringify(res));
      },
      error: () => this.uploading.set(false),
    });
  }

  protected continueToReview(): void {
    this.router.navigate(['/create', this.campaignId(), 'guests', 'review']);
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiAlert } from 'ui/alert';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiInput, UiSelect } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { GuestPayload, UploadResult } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { UploadSummaryComponent } from '../../features/wizard/upload-summary.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { GENDER_OPTIONS } from '../../shared/utils/constants/app.constants';

@Component({
  selector: 'app-guests-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiButton,
    UiCard,
    UiText,
    UiAlert,
    UiEmptyState,
    UiFormField,
    UiInput,
    UiSelect,
    WizardStepsComponent,
    UploadSummaryComponent,
  ],
  templateUrl: './guests-review.component.html',
  styleUrl: './guests-review.component.scss',
})
export class GuestsReviewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Guests;
  protected readonly genderOptions = GENDER_OPTIONS;

  protected readonly result = signal<UploadResult | null>(null);
  protected readonly confirming = signal(false);
  protected readonly confirmed = signal(false);

  protected readonly adding = signal(false);
  protected readonly added = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control(''),
    phone: this.fb.control(''),
    role: this.fb.control(''),
    gender: this.fb.control(''),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly canAdd = computed(() => {
    const v = this.value();
    return !!v.name?.trim() && (!!v.email?.trim() || !!v.phone?.trim());
  });

  ngOnInit(): void {
    const raw = sessionStorage.getItem(`ib_upload_${this.campaignId()}`);
    if (raw) {
      try {
        this.result.set(JSON.parse(raw) as UploadResult);
      } catch {
        /* ignore */
      }
    }
  }

  protected confirm(): void {
    const r = this.result();
    if (!r || this.confirming()) {
      return;
    }
    this.confirming.set(true);
    this.api.confirmUpload(this.campaignId(), r.uploadId).subscribe({
      next: () => {
        this.confirming.set(false);
        this.confirmed.set(true);
      },
      error: () => this.confirming.set(false),
    });
  }

  protected addGuest(): void {
    if (!this.canAdd() || this.adding()) {
      return;
    }
    this.adding.set(true);
    const v = this.form.getRawValue();
    const payload: GuestPayload = {
      name: v.name.trim(),
      email: v.email.trim() || undefined,
      phone: v.phone.trim() || undefined,
      role: v.role.trim() || undefined,
      gender: v.gender || undefined,
    };
    this.api.addGuest(this.campaignId(), payload).subscribe({
      next: () => {
        this.adding.set(false);
        this.added.set(payload.name);
        this.form.reset({ name: '', email: '', phone: '', role: '', gender: '' });
      },
      error: () => this.adding.set(false),
    });
  }
}

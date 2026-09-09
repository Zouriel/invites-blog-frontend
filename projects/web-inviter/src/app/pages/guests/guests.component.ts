import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiAlert } from '@zouriel/ui/alert';
import { UiFileUpload, UiFormField, UiInput, UiSelect } from '@zouriel/ui/form';
import { ApiService } from '../../shared/api/api.service';
import { GuestPayload, UploadResult } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { UploadSummaryComponent } from '../../features/wizard/upload-summary.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import {
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  SelectOption,
  WIZARD_STEPS,
  WIZARD_STEPS_IMPORTED,
  wizardStepEyebrow,
} from '../../shared/utils/constants/app.constants';
import { parseRoleNames } from '../../shared/utils/roles';

type GuestMode = 'manual' | 'import';

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
    UiInput,
    UiSelect,
    WizardStepsComponent,
    UploadSummaryComponent,
  ],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
})
export class GuestsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Guests;

  /**
   * Whether the customer brought this design themselves. Everything on this page that differs for
   * one hangs off it: the shorter step strip, where "next" goes, and the open-link offer — which is
   * made here and nowhere else, because a gallery template's whole value is the per-guest
   * personalisation an anonymous viewer cannot be given.
   */
  protected readonly isImported = signal(false);

  protected readonly steps = computed(() =>
    this.isImported() ? WIZARD_STEPS_IMPORTED : WIZARD_STEPS,
  );
  protected readonly eyebrow = computed(() =>
    wizardStepEyebrow(WizardStepKey.Guests, undefined, this.steps()),
  );

  protected readonly countryOptions = COUNTRY_OPTIONS;
  protected readonly genderOptions = GENDER_OPTIONS;

  /** Role options for the manual-add dropdown, sourced from the campaign's saved roles. */
  protected readonly roleOptions = signal<SelectOption[]>([{ label: '—', value: '' }]);
  protected readonly hasRoles = computed(() => this.roleOptions().length > 1);

  protected readonly mode = signal<GuestMode>('manual');

  /* Import path */
  protected readonly countryControl = this.fb.control('MV');
  protected readonly file = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly result = signal<UploadResult | null>(null);

  /* Manual path */
  protected readonly rows = this.fb.array([this.newRow()]);
  protected readonly manualForm = this.fb.group({ rows: this.rows });
  protected readonly savingManual = signal(false);
  protected readonly manualSaved = signal<number | null>(null);

  private readonly rowsValue = toSignal(this.rows.valueChanges, {
    initialValue: this.rows.getRawValue(),
  });
  protected readonly validRowCount = computed(
    () =>
      this.rowsValue().filter(
        (r) => !!r.name?.trim() || !!r.email?.trim() || !!r.phone?.trim(),
      ).length,
  );

  private newRow() {
    return this.fb.group({
      name: this.fb.control(''),
      email: this.fb.control(''),
      phone: this.fb.control(''),
      role: this.fb.control(''),
      gender: this.fb.control(''),
    });
  }

  ngOnInit(): void {
    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (summary) => {
        const names = parseRoleNames(summary.rolesJson);
        this.roleOptions.set([
          { label: '—', value: '' },
          ...names.map((n) => ({ label: n, value: n })),
        ]);
        this.isImported.set(summary.isImported);
      },
      // Leave the default blank-only option on failure.
      error: () => {},
    });
  }

  protected setMode(mode: GuestMode): void {
    this.mode.set(mode);
  }

  protected addRow(): void {
    this.rows.push(this.newRow());
  }

  protected removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.removeAt(index);
    } else {
      this.rows.at(0).reset({ name: '', email: '', phone: '', role: '', gender: '' });
    }
  }

  protected saveManual(): void {
    if (this.savingManual()) {
      return;
    }
    const payloads: GuestPayload[] = this.rows
      .getRawValue()
      .filter((r) => r.name.trim() || r.email.trim() || r.phone.trim())
      .map((r) => ({
        name: r.name.trim() || undefined,
        email: r.email.trim() || undefined,
        phone: r.phone.trim() || undefined,
        role: r.role.trim() || undefined,
        gender: r.gender.trim() || undefined,
      }));
    if (!payloads.length) {
      return;
    }
    this.savingManual.set(true);
    forkJoin(payloads.map((p) => this.api.addGuest(this.campaignId(), p))).subscribe({
      next: () => {
        this.savingManual.set(false);
        this.manualSaved.set(payloads.length);
      },
      error: () => this.savingManual.set(false),
    });
  }

  /**
   * Where "next" goes. An imported design has no venue to fill in and no RSVP questions worth
   * asking, so it steps straight to who the invitation is from.
   */
  protected continueFromGuests(): void {
    this.router.navigate([
      '/create',
      this.campaignId(),
      this.isImported() ? 'inviter' : 'venue',
    ]);
  }

  /** The label on that button, so it names where it actually goes. */
  protected readonly continueLabel = computed(() =>
    this.isImported() ? 'Next: Inviter →' : 'Next: Venue →',
  );

  /**
   * Whether the host may leave this step having added nobody.
   *
   * <p>Only on a design they brought. A gallery template personalises per guest, so an empty list
   * there is an invitation that reaches nobody and the server refuses to finalize it. An imported
   * one has the other option — a link anybody may open — but that is chosen on the <b>Share</b>
   * step, along with everything else about how the invitation goes out. This step only has to stop
   * insisting on a guest list.</p>
   */
  protected readonly canSkipGuests = computed(() => this.isImported());

  /* Import path */
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

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiCheckbox, UiFormField, UiTextarea } from '@zouriel/ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DeliverySettings } from '../../shared/utils/types/api.types';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import {
  DEFAULT_MESSAGE_TEMPLATE,
  WIZARD_STEPS,
  WIZARD_STEPS_IMPORTED,
  wizardStepEyebrow,
} from '../../shared/utils/constants/app.constants';

/**
 * The last step: how the invitation goes out, and the link it goes out as.
 *
 * <p>This is where the shareable link is <b>made</b>, which is why the choice of what kind of link
 * it is belongs here too rather than beside the guest list. "Who may open this" and "how do I send
 * it" are one decision made in one moment, and splitting them put the same control on two screens
 * that could disagree.</p>
 */
@Component({
  selector: 'app-delivery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiAlert,
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
export class DeliveryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();
  protected readonly stepKey = WizardStepKey.Delivery;

  /** Set once the summary lands; everything this page offers differently hangs off it. */
  protected readonly isImported = signal(false);
  protected readonly guestCount = signal(0);

  protected readonly steps = computed(() =>
    this.isImported() ? WIZARD_STEPS_IMPORTED : WIZARD_STEPS,
  );
  protected readonly eyebrow = computed(() =>
    wizardStepEyebrow(WizardStepKey.Delivery, undefined, this.steps()),
  );

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    // Everyone gets the shareable link; optionally we also email it to the guest list.
    emailGuests: this.fb.control(false),
    messageTemplate: this.fb.control(DEFAULT_MESSAGE_TEMPLATE),
    /**
     * Whether anybody holding the link may open it.
     *
     * <p>Only ever asked for a design the customer brought — a gallery template's whole value is
     * that each guest reads their own name, which an anonymous viewer cannot be given. Off means
     * the link still works, but whoever opens it is checked against the guest list.</p>
     */
    allowAnonymous: this.fb.control(false),
  });

  private readonly formValue = signal(this.form.getRawValue());

  protected readonly allowAnonymous = computed(() => this.formValue().allowAnonymous);

  /**
   * The one combination that cannot be sent: nobody on the list, and a link that checks the list.
   *
   * <p>Blocked here rather than left to the server, which refuses it with
   * CampaignHasNoGuestsException at the very end — the host would have filled in an inviter and a
   * message for an event that was never going to go out.</p>
   */
  protected readonly reachesNobody = computed(
    () => this.isImported() && this.guestCount() === 0 && !this.allowAnonymous(),
  );

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));

    this.api.getCampaignSummary(this.campaignId()).subscribe({
      next: (summary) => {
        this.isImported.set(summary.isImported);
        this.guestCount.set(summary.guestCount);
        // Default ON for an imported design with nobody on the list: that host got here by
        // deliberately skipping the guest step, and a link that checks a list they do not have is
        // the one setting that cannot work for them.
        this.form.controls.allowAnonymous.setValue(
          !!summary.openLink || (summary.isImported && summary.guestCount === 0),
        );
      },
      error: () => {},
    });
  }

  protected submit(): void {
    if (this.saving() || this.reachesNobody()) return;
    const raw = this.form.getRawValue();
    const settings: DeliverySettings = {
      channels: raw.emailGuests ? ['email', 'share'] : ['share'],
      fallbackChannel: null,
      messageTemplate: raw.messageTemplate,
    };
    this.saving.set(true);

    // The link is settled BEFORE finalize, because finalize is what reads it: an anonymous code
    // makes the share link the short /o/ one, and its absence makes it the gated /e/ one.
    const settle = this.isImported()
      ? this.api.generateOpenLink(this.campaignId(), raw.allowAnonymous)
      : null;

    if (settle) {
      settle.subscribe({
        next: () => this.saveAndFinalize(settings),
        error: () => this.saving.set(false),
      });
      return;
    }
    this.saveAndFinalize(settings);
  }

  private saveAndFinalize(settings: DeliverySettings): void {
    this.api.saveDeliverySettings(this.campaignId(), settings).subscribe({
      next: () => this.finalize(),
      error: () => this.saving.set(false),
    });
  }

  private finalize(): void {
    // What KIND of link was made travels with it. The success page says what the link does, and
    // "they verify their email" is exactly wrong for one anybody may open — deriving it from the
    // URL shape would work today and break the moment the route changes.
    const anonymous = this.isImported() && this.form.getRawValue().allowAnonymous;

    this.api.finalizeCampaign(this.campaignId()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.router.navigate(['/create', this.campaignId(), 'success'], {
          state: {
            shareLink: res.shareLink,
            emailed: res.emailed,
            guestCount: res.guestCount,
            anonymous,
          },
        });
      },
      error: () => this.saving.set(false),
    });
  }
}

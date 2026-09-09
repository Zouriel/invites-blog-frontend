import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiStep, UiStepper } from '@zouriel/ui/navigation';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { WIZARD_STEPS, WizardStep } from '../../shared/utils/constants/app.constants';

/** Create-wizard progress indicator (ui-stepper). */
@Component({
  selector: 'app-wizard-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiStepper],
  template: `
    <ui-stepper class="wizard-steps" [steps]="uiSteps()" [active]="activeIndex()" />
  `,
  styles: [
    `
      .wizard-steps {
        display: block;
        margin: 0 0 2rem;
      }
    `,
  ],
})
export class WizardStepsComponent {
  readonly active = input.required<WizardStepKey>();

  /**
   * Which journey this is. Defaults to the gallery one, so every page that was passing nothing keeps
   * the strip it had; a design the customer brought hands in WIZARD_STEPS_IMPORTED, which is three
   * steps rather than eight.
   */
  readonly steps = input<WizardStep[]>(WIZARD_STEPS);

  protected readonly uiSteps = computed<UiStep[]>(() =>
    this.steps().map((s) => ({ label: s.label })),
  );

  protected readonly activeIndex = computed(() =>
    this.steps().findIndex((s) => s.key === this.active()),
  );
}

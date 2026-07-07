import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiStep, UiStepper } from 'ui/navigation';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { WIZARD_STEPS } from '../../shared/utils/constants/app.constants';

/** Create-wizard progress indicator (ui-stepper). */
@Component({
  selector: 'app-wizard-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiStepper],
  template: `
    <ui-stepper class="wizard-steps" [steps]="steps" [active]="activeIndex()" />
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

  protected readonly steps: UiStep[] = WIZARD_STEPS.map((s) => ({ label: s.label }));

  protected readonly activeIndex = computed(() =>
    WIZARD_STEPS.findIndex((s) => s.key === this.active()),
  );
}

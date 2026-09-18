import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { UiStep, UiStepper } from '@zouriel/ui/navigation';
import { ApiService } from '../../shared/api/api.service';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { WIZARD_STEPS, WizardStep, wizardFlowFor } from '../../shared/utils/constants/app.constants';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';

/**
 * Create-wizard progress, with the way back.
 *
 * <p>Given a campaign it works out the campaign's own flow (short for an uploaded design, no Theme
 * step when there is nothing to change), so every page shows the same count and "Back" always goes
 * to the step before this one in that flow. On a phone the dots don't fit, so it reads
 * "Step 4 of 9 · Guests" over a thin progress line instead.</p>
 */
@Component({
  selector: 'app-wizard-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackLinkComponent, UiStepper],
  template: `
    <nav class="wz" aria-label="Progress">
      @if (back(); as b) {
        <app-back-link class="wz__back" [link]="b.link" [query]="b.query" label="Back" />
      }
      <div class="wz__full">
        <ui-stepper [steps]="uiSteps()" [active]="activeIndex()" />
      </div>
      <div class="wz__compact">
        <span class="wz__count">Step {{ activeIndex() + 1 }} of {{ flow().length }} · {{ currentLabel() }}</span>
        <span class="wz__bar" aria-hidden="true"><span class="wz__fill" [style.width.%]="progress()"></span></span>
      </div>
    </nav>
  `,
  styles: [
    `
      .wz {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin: 0 0 2rem;
      }
      .wz__back {
        align-self: flex-start;
        font-size: 0.9rem;
        color: var(--ui-color-text-muted);
        text-decoration: none;
      }
      .wz__back:hover {
        color: var(--ui-color-primary);
      }
      .wz__compact {
        display: none;
      }
      .wz__count {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--ui-color-text-muted);
      }
      .wz__bar {
        display: block;
        height: 4px;
        border-radius: 999px;
        background: var(--ui-color-border);
        overflow: hidden;
      }
      .wz__fill {
        display: block;
        height: 100%;
        background: var(--ui-color-primary);
        border-radius: 999px;
      }
      @media (max-width: 640px) {
        .wz__full {
          display: none;
        }
        .wz__compact {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
      }
    `,
  ],
})
export class WizardStepsComponent {
  private readonly api = inject(ApiService);

  readonly active = input.required<WizardStepKey>();

  /** A page that already knows its flow may pass it; the campaign's own flow wins once loaded. */
  readonly steps = input<WizardStep[] | null>(null);

  /** The campaign being built. Needed for the right flow and for Back. */
  readonly campaignId = input<string | null>(null);

  private readonly campaignFlow = signal<WizardStep[] | null>(null);

  constructor() {
    effect(() => {
      const id = this.campaignId();
      if (!id) return;
      untracked(() =>
        this.api.getCampaignSummary(id).subscribe({
          next: (s) => this.campaignFlow.set(wizardFlowFor(s)),
          error: () => {},
        }),
      );
    });
  }

  protected readonly flow = computed(() => this.campaignFlow() ?? this.steps() ?? WIZARD_STEPS);

  protected readonly uiSteps = computed<UiStep[]>(() => this.flow().map((s) => ({ label: s.label })));

  protected readonly activeIndex = computed(() =>
    Math.max(0, this.flow().findIndex((s) => s.key === this.active())),
  );

  protected readonly currentLabel = computed(() => this.flow()[this.activeIndex()]?.label ?? '');

  protected readonly progress = computed(() => ((this.activeIndex() + 1) / Math.max(1, this.flow().length)) * 100);

  /** Where "Back" goes: the step before this one in this campaign's flow. */
  protected readonly back = computed<{ link: string[]; query: Record<string, string> } | null>(() => {
    const id = this.campaignId();
    const i = this.activeIndex();
    if (!id || i <= 0) return null;
    const prev = this.flow()[i - 1];
    const none: Record<string, string> = {};
    switch (prev.key) {
      case WizardStepKey.Event:
      case WizardStepKey.Design:
        return { link: ['/events/new'], query: { ...none, event: id } };
      case WizardStepKey.Upload:
        return { link: ['/bring-your-own'], query: { ...none, forEvent: id } };
      default:
        return { link: ['/create', id, prev.path], query: none };
    }
  });
}

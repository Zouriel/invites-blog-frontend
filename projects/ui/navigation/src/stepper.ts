import { Component, input } from '@angular/core';

export interface UiStep {
  label: string;
  description?: string;
}

/** `ui-stepper` — horizontal progress through ordered steps. */
@Component({
  selector: 'ui-stepper',
  template: `
    <ol class="ui-stepper">
      @for (step of steps(); track $index; let i = $index, last = $last) {
        <li class="step" [class.done]="i < active()" [class.active]="i === active()">
          <span class="marker" aria-hidden="true">
            @if (i < active()) { ✓ } @else { {{ i + 1 }} }
          </span>
          <span class="text">
            <span class="label">{{ step.label }}</span>
            @if (step.description) { <span class="desc">{{ step.description }}</span> }
          </span>
          @if (!last) { <span class="bar" aria-hidden="true"></span> }
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    .ui-stepper {
      display: flex; margin: 0; padding: 0; list-style: none; font-family: var(--ui-font-default);
      overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;
    }
    .ui-stepper::-webkit-scrollbar { display: none; }
    .step { display: flex; align-items: center; gap: var(--ui-space-2); flex: 1 1 auto; min-width: fit-content; }
    .step:last-child { flex: 0 1 auto; }
    .marker {
      display: inline-flex; align-items: center; justify-content: center; flex: none;
      width: 24px; height: 24px; border-radius: 50%;
      border: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); font-weight: 600;
    }
    .step.active .marker { border-color: var(--ui-color-primary); color: var(--ui-color-primary); }
    .step.done .marker { background: var(--ui-color-primary); border-color: transparent; color: var(--ui-color-primary-contrast); }
    .text { display: flex; flex-direction: column; }
    .label { font-size: var(--ui-font-size-sm); color: var(--ui-color-text); font-weight: 500; }
    .step.active .label { color: var(--ui-color-text); }
    .desc { font-size: 12px; color: var(--ui-color-text-muted); }
    .bar { flex: 1; height: 1px; min-width: var(--ui-space-4); background: var(--ui-color-border); margin: 0 var(--ui-space-2); }
    .step.done .bar { background: var(--ui-color-primary); }
    /* Narrow screens: keep only the active step labelled so all markers fit without clipping. */
    @media (max-width: 560px) {
      .step { gap: var(--ui-space-1); }
      .step:not(.active) .text { display: none; }
      .bar { min-width: var(--ui-space-2); margin: 0 var(--ui-space-1); }
    }
  `,
})
export class UiStepper {
  steps = input<UiStep[]>([]);
  active = input(0);
}

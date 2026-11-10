import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSegmented } from '@zouriel/ui/button';
import { UiFormField, UiInput, UiSlider } from '@zouriel/ui/form';
import { COUNTDOWN_DONE, type DesignCountdown, type DesignElement } from '../model/scene';
import { ColorRefFieldComponent } from './color-ref-field.component';

/**
 * A countdown's own settings: how far down it counts, how it looks, its boxes and what it says on the
 * day. The date itself is never set here: it is the event's, filled in when someone makes an event
 * with the design.
 */
@Component({
  selector: 'app-countdown-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSegmented, UiSlider, UiInput, UiFormField, ColorRefFieldComponent],
  template: `
    <p class="hint">Counts down to the event's own date and time, in the event's time zone. Nothing to set: each event that uses this design fills it in.</p>
    <ui-segmented size="sm" label="Down to" [options]="unitOptions" [value]="cd().units ?? 'seconds'"
      (valueChange)="set({ units: $any($event) })" />
    <ui-segmented size="sm" label="Look" [options]="lookOptions" [value]="cd().look ?? 'tiles'"
      (valueChange)="set({ look: $any($event) })" />
    <app-color-ref-field [label]="cd().look === 'line' ? 'Background' : 'Box colour'" [value]="cd().fill ?? null" (changed)="set({ fill: $event })" />
    <app-color-ref-field label="Outline" [value]="cd().stroke ?? null" (changed)="setOutline($event)" />
    @if (cd().stroke) {
      <ui-form-field label="Outline width"><ui-slider label="Outline width" [min]="0.5" [max]="6" [step]="0.5" [ngModel]="cd().strokeWidth || 1"
        (ngModelChange)="set({ strokeWidth: $event }, 'sw')" /></ui-form-field>
    }
    @if (cd().fill || cd().stroke) {
      <ui-form-field label="Corners"><ui-slider label="Corners" [min]="0" [max]="60" [step]="1" [ngModel]="cd().radius ?? 12"
        (ngModelChange)="set({ radius: $event }, 'r')" /></ui-form-field>
    }
    @if (cd().look !== 'line') {
      <ui-form-field label="Space between"><ui-slider label="Space between" [min]="0" [max]="40" [step]="1" [ngModel]="cd().gap ?? 10"
        (ngModelChange)="set({ gap: $event }, 'gap')" /></ui-form-field>
    }
    <ui-input size="sm" label="On the day it says" [ngModel]="cd().done ?? ''" placeholder="Leave empty to hide it on the day"
      (ngModelChange)="set({ done: $event }, 'done')" />
    <p class="hint">The day after the event it hides by itself.</p>
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
  `,
})
export class CountdownFieldComponent {
  el = input.required<DesignElement>();
  /** A change to the countdown; `key` merges a slider's drag (or typing) into one undo step. */
  changed = output<{ patch: Partial<DesignCountdown>; key?: string }>();

  protected readonly unitOptions = [
    { value: 'days', label: 'Days' }, { value: 'hours', label: 'Hours' }, { value: 'minutes', label: 'Minutes' }, { value: 'seconds', label: 'Seconds' },
  ];
  protected readonly lookOptions = [{ value: 'tiles', label: 'Tiles' }, { value: 'line', label: 'One line' }];

  protected cd(): Partial<DesignCountdown> {
    return this.el().countdown ?? { done: COUNTDOWN_DONE };
  }

  protected set(patch: Partial<DesignCountdown>, key?: string): void {
    this.changed.emit({ patch, key });
  }

  protected setOutline(color: string | null): void {
    const width = this.cd().strokeWidth;
    this.set({ stroke: color, strokeWidth: color && !width ? 1 : width ?? 0 });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSegmented } from '@zouriel/ui/button';
import { UiNumberInput, UiSelect } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { DesignStore } from '../design.store';
import type { DesignElement, Typography } from '../model/scene';
import { ColorRefFieldComponent } from './color-ref-field.component';

const CURVES = [
  { value: '0', label: 'Straight' }, { value: '30', label: 'Arch' }, { value: '60', label: 'Rainbow' },
  { value: '-30', label: 'Smile' }, { value: '100', label: 'Circle' },
];
const OUTLINES = [{ value: '0.5', label: 'Thin' }, { value: '1', label: 'Medium' }, { value: '2', label: 'Thick' }];

export type TextExtrasChange = { curve?: number; image?: string | null; style?: Partial<Typography> };

/**
 * A text's shape and finish: bent along an arc, an outline around the letters, or a picture shown
 * inside them. Named choices first; exact numbers in Fine-tune.
 */
@Component({
  selector: 'app-text-extras-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSegmented, UiNumberInput, UiSelect, UiPanelSection, ColorRefFieldComponent],
  template: `
    <ui-segmented size="sm" label="Curve" [options]="curves" [value]="named(curves, el().text?.curve ?? 0)" (valueChange)="$event !== null && changed.emit({ curve: +$event })" />
    @if (el().text?.curve) {
      <p class="hint">Curved text stays on one line; widen the box to fit more round the curve.</p>
    }
    <app-color-ref-field label="Outline" [value]="el().text?.style?.stroke ?? null" (changed)="setOutline($event)" />
    @if (el().text?.style?.stroke) {
      <ui-segmented size="sm" label="Outline width" [options]="outlines" [value]="named(outlines, el().text?.style?.strokeWidth ?? 1)"
        (valueChange)="$event !== null && changed.emit({ style: { strokeWidth: +$event } })" />
    }
    <ui-select size="sm" label="Picture inside the letters" [options]="pictures()" [ngModel]="el().text?.image ?? ''"
      (ngModelChange)="changed.emit({ image: $event || null })" />
    @if (pictures().length === 1) {
      <p class="hint">Add a picture to the design first (Pictures, on the left); then it can fill the letters.</p>
    } @else if (el().text?.image) {
      <p class="hint">Works best with big, bold letters.</p>
    }
    <ui-panel-section title="Fine-tune (exact values)" [open]="false">
      <div class="grid2">
        <ui-number-input size="sm" label="Curve" [steppers]="false" [min]="-100" [max]="100" [ngModel]="el().text?.curve ?? 0"
          (ngModelChange)="$event !== null && changed.emit({ curve: $event })" ariaLabel="Curve" />
        <ui-number-input size="sm" label="Outline" [steppers]="false" [min]="0" [max]="20" [step]="0.25" [precision]="2"
          [ngModel]="el().text?.style?.strokeWidth ?? 0" (ngModelChange)="$event !== null && changed.emit({ style: { strokeWidth: $event } })" ariaLabel="Outline width" />
      </div>
    </ui-panel-section>
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class TextExtrasFieldComponent {
  private readonly store = inject(DesignStore);
  el = input.required<DesignElement>();
  changed = output<TextExtrasChange>();

  protected readonly curves = CURVES;
  protected readonly outlines = OUTLINES;

  /** The design's pictures, by their names. */
  protected readonly pictures = computed(() => {
    const assets = this.store.scene()?.assets ?? {};
    const list = Object.entries(assets).filter(([, a]) => a.kind === 'image').map(([id, a], i) => ({ value: id, label: a.name ?? `Picture ${i + 1}` }));
    return [{ value: '', label: 'None' }, ...list];
  });

  protected named(options: { value: string }[], v: number): string | null {
    return options.find((o) => Math.abs(+o.value - v) < 0.001)?.value ?? null;
  }

  protected setOutline(color: string | null): void {
    const width = this.el().text?.style?.strokeWidth;
    this.changed.emit({ style: { stroke: color, strokeWidth: color && !width ? 1 : width ?? 0 } });
  }
}

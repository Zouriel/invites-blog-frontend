import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSelect, UiSlider, UiFormField } from '@zouriel/ui/form';
import { DesignStore } from '../design.store';
import type { DesignElement, Typography } from '../model/scene';
import { ColorRefFieldComponent } from './color-ref-field.component';

export type TextExtrasChange = { curve?: number; image?: string | null; style?: Partial<Typography> };

/**
 * A text's shape and finish: bent along an arc, an outline around the letters, or a picture shown
 * inside them. Named choices first; exact numbers in Fine-tune.
 */
@Component({
  selector: 'app-text-extras-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSelect, UiSlider, ColorRefFieldComponent, UiFormField],
  template: `
    <ui-form-field label="Curve"><ui-slider label="Curve" [min]="-100" [max]="100" [step]="1" [ngModel]="el().text?.curve ?? 0" (ngModelChange)="changed.emit({ curve: $event })" /></ui-form-field>
    @if (el().text?.curve) {
      <p class="hint">Curved text stays on one line; widen the box to fit more round the curve.</p>
    }
    <app-color-ref-field label="Outline" [value]="el().text?.style?.stroke ?? null" (changed)="setOutline($event)" />
    @if (el().text?.style?.stroke) {
      <ui-form-field label="Outline width"><ui-slider label="Outline width" [min]="0" [max]="6" [step]="0.25" [ngModel]="el().text?.style?.strokeWidth ?? 1"
        (ngModelChange)="changed.emit({ style: { strokeWidth: $event } })" /></ui-form-field>
    }
    <ui-select size="sm" label="Picture inside the letters" [options]="pictures()" [ngModel]="el().text?.image ?? ''"
      (ngModelChange)="changed.emit({ image: $event || null })" />
    @if (pictures().length === 1) {
      <p class="hint">Add a picture to the design first (Pictures, on the left); then it can fill the letters.</p>
    } @else if (el().text?.image) {
      <p class="hint">Works best with big, bold letters.</p>
    }
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


  /** The design's pictures, by their names. */
  protected readonly pictures = computed(() => {
    const assets = this.store.scene()?.assets ?? {};
    const list = Object.entries(assets).filter(([, a]) => a.kind === 'image').map(([id, a], i) => ({ value: id, label: a.name ?? `Picture ${i + 1}` }));
    return [{ value: '', label: 'None' }, ...list];
  });

  protected setOutline(color: string | null): void {
    const width = this.el().text?.style?.strokeWidth;
    this.changed.emit({ style: { stroke: color, strokeWidth: color && !width ? 1 : width ?? 0 } });
  }
}

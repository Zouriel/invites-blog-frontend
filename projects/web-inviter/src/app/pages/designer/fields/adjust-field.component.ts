import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiSlider, UiFormField } from '@zouriel/ui/form';
import type { DesignAdjust } from '../model/scene';
import { ColorRefFieldComponent } from './color-ref-field.component';

/** One-tap looks, as photo apps offer them; every number is still in Fine-tune. */
export const PHOTO_LOOKS: { id: string; label: string; adjust: DesignAdjust | null; css: string }[] = [
  { id: 'original', label: 'Original', adjust: null, css: 'none' },
  { id: 'bright', label: 'Bright', adjust: { brightness: 1.15, contrast: 1.05, saturation: 1.15 }, css: 'brightness(1.15) contrast(1.05) saturate(1.15)' },
  { id: 'moody', label: 'Moody', adjust: { brightness: 0.85, contrast: 1.25, saturation: 0.8 }, css: 'brightness(0.85) contrast(1.25) saturate(0.8)' },
  { id: 'bw', label: 'Black & white', adjust: { saturation: 0, contrast: 1.15 }, css: 'saturate(0) contrast(1.15)' },
  { id: 'vintage', label: 'Vintage', adjust: { sepia: 0.55, contrast: 0.9, brightness: 1.05, grain: 0.25 }, css: 'sepia(0.55) contrast(0.9) brightness(1.05)' },
  { id: 'faded', label: 'Faded', adjust: { contrast: 0.75, brightness: 1.1, saturation: 0.7 }, css: 'contrast(0.75) brightness(1.1) saturate(0.7)' },
  { id: 'film', label: 'Film', adjust: { contrast: 1.1, saturation: 0.9, grain: 0.45 }, css: 'contrast(1.1) saturate(0.9)' },
  { id: 'duotone', label: 'Duotone', adjust: { duotone: { dark: '#1f2a44', light: '#e8c27a' } }, css: 'grayscale(1) sepia(0.6)' },
];

const same = (a: DesignAdjust | null | undefined, b: DesignAdjust | null) => JSON.stringify(a ?? null) === JSON.stringify(b);

/** A picture's or photo slot's look: presets, then brightness, contrast, saturation, warmth, grain and duotone colours. */
@Component({
  selector: 'app-adjust-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSlider, ColorRefFieldComponent, UiFormField],
  template: `
    <div class="looks" role="group" aria-label="Looks">
      @for (l of looks; track l.id) {
        <button type="button" class="look" [class.on]="current() === l.id" (click)="changed.emit(l.adjust)" [attr.aria-pressed]="current() === l.id">
          <span class="swatch" [style.filter]="l.css"></span>
          <span class="name">{{ l.label }}</span>
        </button>
      }
    </div>
    @if (value()?.duotone; as d) {
      <app-color-ref-field label="Shadows" [allowNone]="false" [value]="d.dark" (changed)="$event && set({ duotone: { dark: $event, light: d.light } })" />
      <app-color-ref-field label="Highlights" [allowNone]="false" [value]="d.light" (changed)="$event && set({ duotone: { dark: d.dark, light: $event } })" />
    }
    <ui-form-field label="Brightness"><ui-slider label="Brightness" [min]="0" [max]="200" [step]="5" [ngModel]="(value()?.brightness ?? 1) * 100" (ngModelChange)="set({ brightness: $event / 100 })" /></ui-form-field>
    <ui-form-field label="Contrast"><ui-slider label="Contrast" [min]="0" [max]="200" [step]="5" [ngModel]="(value()?.contrast ?? 1) * 100" (ngModelChange)="set({ contrast: $event / 100 })" /></ui-form-field>
    <ui-form-field label="Saturation"><ui-slider label="Saturation" [min]="0" [max]="300" [step]="5" [ngModel]="(value()?.saturation ?? 1) * 100" (ngModelChange)="set({ saturation: $event / 100 })" /></ui-form-field>
    <ui-form-field label="Warmth"><ui-slider label="Warmth" [min]="0" [max]="100" [step]="5" [ngModel]="(value()?.sepia ?? 0) * 100" (ngModelChange)="set({ sepia: $event / 100 })" /></ui-form-field>
    <ui-form-field label="Grain"><ui-slider label="Grain" [min]="0" [max]="100" [step]="5" [ngModel]="(value()?.grain ?? 0) * 100" (ngModelChange)="set({ grain: $event / 100 })" /></ui-form-field>
    @if (value()) {
      <ui-button size="sm" variant="outline" (click)="changed.emit(null)">Back to the original</ui-button>
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .looks { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 6px; }
    .look { display: grid; justify-items: center; gap: 3px; padding: 4px 2px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm);
      background: var(--ui-color-surface); color: var(--ui-color-text); cursor: pointer; min-width: 0; }
    .look.on { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .look:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .swatch { width: 40px; height: 28px; border-radius: 4px; background: linear-gradient(135deg, #3d6d9e, #e8b86a 55%, #c45b4a); }
    .name { font-size: 10px; line-height: 1.2; text-align: center; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class AdjustFieldComponent {
  value = input<DesignAdjust | null>(null);
  changed = output<DesignAdjust | null>();
  protected readonly looks = PHOTO_LOOKS;
  protected readonly current = computed(() => PHOTO_LOOKS.find((l) => same(this.value(), l.adjust))?.id ?? null);

  protected set(change: Partial<DesignAdjust>): void {
    this.changed.emit({ ...(this.value() ?? {}), ...change });
  }
}

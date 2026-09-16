import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiNumberInput, UiSelect, UiSwitch, type UiSelectOption } from '@zouriel/ui/form';
import { UiSegmented } from '@zouriel/ui/button';
import { DesignStore } from '../design.store';
import type { Typography } from '../model/scene';
import { isFontKey } from '../model/scene-ops';
import { ColorRefFieldComponent } from './color-ref-field.component';

/** Font, size, weight, colour, alignment and spacing — shared by text, buttons and dress colours. */
@Component({
  selector: 'app-typography-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiNumberInput, UiSelect, UiSwitch, UiSegmented, ColorRefFieldComponent],
  template: `
    @if (style(); as s) {
      <div class="row">
        <span class="label">Font</span>
        <ui-select size="sm" [options]="fontOptions()" [ngModel]="s.font ?? ''" (ngModelChange)="set({ font: $event || null })" label="Font" />
      </div>
      <div class="pair">
        <ui-number-input size="sm" label="Size" [steppers]="false" [min]="4" [max]="400" [ngModel]="s.size" (ngModelChange)="set({ size: $event ?? s.size })" ariaLabel="Font size" />
        <ui-select size="sm" [options]="weights" [ngModel]="'' + s.weight" (ngModelChange)="set({ weight: +$event })" label="Weight" />
      </div>
      <app-color-ref-field label="Colour" [allowNone]="false" [value]="s.color" (changed)="set({ color: $event })" />
      <div class="row">
        <span class="label">Align</span>
        <ui-segmented size="sm" label="Alignment" [options]="aligns" [value]="s.align" (valueChange)="set({ align: $any($event) })" />
      </div>
      @if (showVertical()) {
        <div class="row">
          <span class="label">Vertical</span>
          <ui-segmented size="sm" label="Vertical alignment" [options]="valigns" [value]="s.valign" (valueChange)="set({ valign: $any($event) })" />
        </div>
      }
      <div class="pair">
        <ui-number-input size="sm" label="Line" [steppers]="false" [min]="0.6" [max]="4" [step]="0.05" [precision]="2" [ngModel]="s.lineHeight" (ngModelChange)="set({ lineHeight: $event ?? s.lineHeight })" ariaLabel="Line height" />
        <ui-number-input size="sm" label="Space" suffix="em" [steppers]="false" [min]="-0.2" [max]="2" [step]="0.01" [precision]="2" [ngModel]="s.letterSpacing" (ngModelChange)="set({ letterSpacing: $event ?? 0 })" ariaLabel="Letter spacing" />
      </div>
      <div class="switches">
        <label><ui-switch [ngModel]="!!s.italic" (ngModelChange)="set({ italic: $event })" /> Italic</label>
        <label><ui-switch [ngModel]="!!s.uppercase" (ngModelChange)="set({ uppercase: $event })" /> Capitals</label>
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: 8px; }
    .row { display: grid; grid-template-columns: 74px minmax(0, 1fr); align-items: center; gap: 8px; }
    .label { font-size: 12px; color: var(--ui-color-text-muted); }
    .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    .switches { display: flex; gap: 16px; font-size: 12.5px; }
    .switches label { display: flex; align-items: center; gap: 6px; }
  `,
})
export class TypographyFieldComponent {
  private readonly store = inject(DesignStore);

  style = input<Typography | null | undefined>(null);
  showVertical = input(true);
  readonly changed = output<Typography>();

  protected readonly weights: UiSelectOption[] = [
    { value: '300', label: 'Light' }, { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' },
    { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' },
  ];
  protected readonly aligns = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }];
  protected readonly valigns = [{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }];

  /** Theme fonts first — the inviter can change those — then every hosted font. */
  protected readonly fontOptions = computed<UiSelectOption[]>(() => {
    const scene = this.store.scene();
    const catalog = this.store.catalog();
    const theme = (scene?.theme ?? []).filter((t) => isFontKey(t.key)).map((t) => {
      const font = catalog?.fonts.find((f) => f.id === t.value);
      return { value: `theme:${t.key}`, label: `${t.label} (${font?.name ?? t.value})` };
    });
    const fixed = (catalog?.fonts ?? []).map((f) => ({ value: f.id, label: `${f.name} — fixed` }));
    return [...theme, ...fixed];
  });

  protected set(patch: Partial<Typography>): void {
    const s = this.style();
    if (s) this.changed.emit({ ...s, ...patch });
  }
}

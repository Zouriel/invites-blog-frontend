import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSegmented } from '@zouriel/ui/button';
import { UiNumberInput, UiSelect, UiSwitch } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { DesignStore } from '../design.store';
import type { DesignBevel, DesignElement, DesignGlow } from '../model/scene';
import { BEVEL_MAX_SIZE, BEVEL_MIN_SIZE, BLEND_MODES, GLOW_MAX_SIZE, GLOW_MIN_SIZE } from '../render/effects';
import { ColorRefFieldComponent } from './color-ref-field.component';

export const BLEND_LABELS: Record<string, string> = {
  normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten',
  'color-dodge': 'Colour dodge', 'color-burn': 'Colour burn', 'hard-light': 'Hard light', 'soft-light': 'Soft light',
  difference: 'Difference', exclusion: 'Exclusion', hue: 'Hue', saturation: 'Saturation', color: 'Colour', luminosity: 'Luminosity',
};
const BLEND_OPTIONS = BLEND_MODES.map((m) => ({ value: m, label: BLEND_LABELS[m] }));

const BEVEL_SIZES = [{ value: '2', label: 'Small' }, { value: '4', label: 'Medium' }, { value: '8', label: 'Large' }];
const GLOW_SIZES = [{ value: '6', label: 'Small' }, { value: '12', label: 'Medium' }, { value: '24', label: 'Large' }];
const STRENGTHS = [{ value: '0.4', label: 'Subtle' }, { value: '0.75', label: 'Medium' }, { value: '1', label: 'Strong' }];
const STYLES = [{ value: 'raised', label: 'Raised' }, { value: 'pressed', label: 'Pressed in' }];

type Effects = Pick<DesignElement, 'bevel' | 'innerGlow' | 'outerGlow' | 'blend'>;

/** Short words for what an element has on, for the section's badge. */
export function effectsBadge(el: DesignElement): string | null {
  const on = [el.bevel && 'Bevel', el.innerGlow && 'Inner glow', el.outerGlow && 'Glow', el.blend && el.blend !== 'normal' && BLEND_LABELS[el.blend]].filter(Boolean);
  return on.length ? on.join(', ') : null;
}

/**
 * Layer effects, as in Photoshop's layer styles: how the element blends with what is under it, a bevel
 * (raised or pressed in), an inner glow (with its own blend) and an outer glow. Each is a switch with
 * named sizes and strengths; exact numbers sit in a closed Fine-tune.
 */
@Component({
  selector: 'app-effects-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSegmented, UiNumberInput, UiSelect, UiSwitch, UiPanelSection, ColorRefFieldComponent],
  template: `
    <ui-select size="sm" label="Blend with what's under it" [options]="blends" [ngModel]="el().blend ?? 'normal'"
      (ngModelChange)="changed.emit({ blend: $event === 'normal' ? null : $event })" />
    <p class="hint">Mixes this with everything beneath it, the page colour included: Multiply darkens, Screen lightens, Overlay adds contrast.</p>

    <div class="fx">
      <label class="switch"><ui-switch [ngModel]="!!el().bevel" (ngModelChange)="toggle('bevel', $event)" ariaLabel="Bevel" /> Bevel</label>
      @if (el().bevel; as b) {
        <ui-segmented size="sm" label="Bevel" [options]="styles" [value]="b.style ?? 'raised'" (valueChange)="$event !== null && bevel({ style: $any($event) })" />
        <ui-segmented size="sm" label="Size" [options]="bevelSizes" [value]="named(bevelSizes, b.size ?? 4)" (valueChange)="$event !== null && bevel({ size: +$event })" />
        <ui-segmented size="sm" label="Strength" [options]="strengths" [value]="named(strengths, b.strength ?? 0.7)" (valueChange)="$event !== null && bevel({ strength: +$event })" />
        <ui-panel-section title="Fine-tune bevel (exact values)" [open]="false">
          <div class="grid2">
            <ui-number-input size="sm" label="Size" [steppers]="false" [min]="bevelMin" [max]="bevelMax" [step]="0.5" [precision]="1"
              [ngModel]="b.size ?? 4" (ngModelChange)="$event !== null && bevel({ size: $event })" ariaLabel="Bevel size" />
            <ui-number-input size="sm" label="Strength" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2"
              [ngModel]="b.strength ?? 0.7" (ngModelChange)="$event !== null && bevel({ strength: $event })" ariaLabel="Bevel strength" />
          </div>
        </ui-panel-section>
      }
    </div>

    @for (g of glows; track g.key) {
      <div class="fx">
        <label class="switch"><ui-switch [ngModel]="!!el()[g.key]" (ngModelChange)="toggle(g.key, $event)" [ariaLabel]="g.label" /> {{ g.label }}</label>
        @if (el()[g.key]; as v) {
          <app-color-ref-field [label]="g.label + ' colour'" [allowNone]="false" [value]="v.color ?? '#ffffff'" (changed)="glow(g.key, { color: $event })" />
          <ui-segmented size="sm" label="Size" [options]="glowSizes" [value]="named(glowSizes, v.size ?? 10)" (valueChange)="$event !== null && glow(g.key, { size: +$event })" />
          <ui-segmented size="sm" label="Strength" [options]="strengths" [value]="named(strengths, v.strength ?? 0.75)" (valueChange)="$event !== null && glow(g.key, { strength: +$event })" />
          @if (g.key === 'innerGlow') {
            <ui-select size="sm" label="Glow blend" [options]="blends" [ngModel]="v.blend ?? 'screen'" (ngModelChange)="glow(g.key, { blend: $event })" />
          }
          <ui-panel-section [title]="'Fine-tune ' + g.label.toLowerCase() + ' (exact values)'" [open]="false">
            <div class="grid2">
              <ui-number-input size="sm" label="Size" [steppers]="false" [min]="glowMin" [max]="glowMax" [step]="1" [precision]="1"
                [ngModel]="v.size ?? 10" (ngModelChange)="$event !== null && glow(g.key, { size: $event })" [ariaLabel]="g.label + ' size'" />
              <ui-number-input size="sm" label="Strength" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2"
                [ngModel]="v.strength ?? 0.75" (ngModelChange)="$event !== null && glow(g.key, { strength: $event })" [ariaLabel]="g.label + ' strength'" />
            </div>
          </ui-panel-section>
        }
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .fx { display: grid; gap: 8px; padding-top: 10px; border-top: 1px solid var(--ui-color-border); }
    .switch { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class EffectsFieldComponent {
  private readonly store = inject(DesignStore);
  el = input.required<DesignElement>();
  changed = output<Partial<Effects>>();

  protected readonly blends = BLEND_OPTIONS;
  protected readonly styles = STYLES;
  protected readonly bevelSizes = BEVEL_SIZES;
  protected readonly glowSizes = GLOW_SIZES;
  protected readonly strengths = STRENGTHS;
  protected readonly bevelMin = BEVEL_MIN_SIZE;
  protected readonly bevelMax = BEVEL_MAX_SIZE;
  protected readonly glowMin = GLOW_MIN_SIZE;
  protected readonly glowMax = GLOW_MAX_SIZE;
  protected readonly glows = [
    { key: 'outerGlow' as const, label: 'Outer glow' },
    { key: 'innerGlow' as const, label: 'Inner glow' },
  ];

  /** The theme's accent (or first colour), for a new outer glow. */
  private readonly accent = computed(() => {
    const theme = this.store.scene()?.theme.filter((t) => /^#/.test(t.value)) ?? [];
    const key = (theme.find((t) => t.key === 'accent') ?? theme[0])?.key;
    return key ? `theme:${key}` : '#ffffff';
  });

  protected named(options: { value: string }[], v: number): string | null {
    return options.find((o) => Math.abs(+o.value - v) < 0.001)?.value ?? null;
  }

  protected toggle(key: 'bevel' | 'innerGlow' | 'outerGlow', on: boolean): void {
    if (!on) { this.changed.emit({ [key]: null }); return; }
    const start: Effects = {
      bevel: { style: 'raised', size: 4, strength: 0.7 },
      innerGlow: { color: '#ffffff', size: 6, strength: 0.75, blend: 'screen' },
      outerGlow: { color: this.accent(), size: 12, strength: 0.75 },
    };
    this.changed.emit({ [key]: start[key] });
  }

  protected bevel(change: Partial<DesignBevel>): void {
    const b = this.el().bevel;
    if (b) this.changed.emit({ bevel: { ...b, ...change } });
  }

  protected glow(key: 'innerGlow' | 'outerGlow', change: Partial<DesignGlow>): void {
    const g = this.el()[key];
    if (g) this.changed.emit({ [key]: { ...g, ...change } });
  }
}

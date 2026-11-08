import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSegmented } from '@zouriel/ui/button';
import { UiNumberInput, UiSelect, UiSwitch } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { DesignStore } from '../design.store';
import type { DesignBevel, DesignElement, DesignGlow, DesignShadow } from '../model/scene';
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

type Effects = Pick<DesignElement, 'bevel' | 'innerGlow' | 'outerGlow' | 'blend' | 'shadow' | 'light'>;

/** Short words for what an element has on, for the section's badge. */
export function effectsBadge(el: DesignElement): string | null {
  const on = [el.shadow && 'Shadow', el.bevel && 'Bevel', el.innerGlow && 'Inner glow', el.outerGlow && 'Glow', el.blend && el.blend !== 'normal' && BLEND_LABELS[el.blend]].filter(Boolean);
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
      <label class="switch"><ui-switch [ngModel]="!!el().shadow" (ngModelChange)="toggleShadow($event)" ariaLabel="Drop shadow" /> Drop shadow</label>
      @if (el().shadow; as sh) {
        <ui-segmented size="sm" label="Shadow" [options]="shadowLooks" [value]="shadowLook(sh)" (valueChange)="$event !== null && shadowPreset($event)" />
        <app-color-ref-field label="Shadow colour" [allowNone]="false" [value]="sh.color ?? '#000000'" (changed)="shadow({ color: $event })" />
        <ui-panel-section title="Fine-tune shadow (exact values)" [open]="false">
          <div class="grid2">
            <ui-number-input size="sm" label="Across" [steppers]="false" [min]="-60" [max]="60" [ngModel]="sh.x ?? 0" (ngModelChange)="$event !== null && shadow({ x: $event })" ariaLabel="Shadow across" />
            <ui-number-input size="sm" label="Down" [steppers]="false" [min]="-60" [max]="60" [ngModel]="sh.y ?? 4" (ngModelChange)="$event !== null && shadow({ y: $event })" ariaLabel="Shadow down" />
            <ui-number-input size="sm" label="Softness" [steppers]="false" [min]="0" [max]="60" [ngModel]="sh.blur ?? 8" (ngModelChange)="$event !== null && shadow({ blur: $event })" ariaLabel="Shadow softness" />
            <ui-number-input size="sm" label="Strength" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2" [ngModel]="sh.strength ?? 0.35" (ngModelChange)="$event !== null && shadow({ strength: $event })" ariaLabel="Shadow strength" />
          </div>
        </ui-panel-section>
      }
    </div>

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

    <div class="fx">
      <p class="label">Light</p>
      <div class="dial" role="group" aria-label="Where the light comes from">
        @for (d of lightDirections; track d.angle) {
          <button type="button" class="dir" [class.on]="(el().light?.angle ?? 135) === d.angle" [style.grid-area]="d.area"
            (click)="light({ angle: d.angle })" [attr.aria-label]="'Light from the ' + d.label" [attr.aria-pressed]="(el().light?.angle ?? 135) === d.angle" [title]="d.label">{{ d.arrow }}</button>
        }
        <span class="sun" aria-hidden="true">✦</span>
      </div>
      <app-color-ref-field label="Light colour" [allowNone]="false" [value]="el().light?.color ?? '#ffffff'" (changed)="light({ color: $event })" />
      <p class="hint">Where the bevel and an embossed or engraved pattern are lit from, and the light's colour.</p>
      <ui-panel-section title="Fine-tune light (exact values)" [open]="false">
        <ui-number-input size="sm" label="Angle" suffix="°" [steppers]="false" [min]="0" [max]="360" [ngModel]="el().light?.angle ?? 135"
          (ngModelChange)="$event !== null && light({ angle: $event })" ariaLabel="Light angle" />
      </ui-panel-section>
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
    .label { margin: 0; font-size: 13px; font-weight: 600; }
    .dial { display: grid; grid-template-columns: repeat(3, 40px); grid-template-rows: repeat(3, 40px); gap: 4px;
      grid-template-areas: "nw n ne" "w c e" "sw s se"; justify-content: start; }
    .dir { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm); background: var(--ui-color-surface);
      color: var(--ui-color-text); cursor: pointer; font-size: 16px; min-width: 0; }
    .dir.on { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .dir:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .sun { grid-area: c; display: grid; place-items: center; color: var(--ui-color-text-muted); }
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

  /** Photoshop's angle (counter-clockwise from the right), drawn as where the light sits. */
  protected readonly lightDirections = [
    { angle: 135, area: 'nw', arrow: '↖', label: 'top left' }, { angle: 90, area: 'n', arrow: '↑', label: 'top' }, { angle: 45, area: 'ne', arrow: '↗', label: 'top right' },
    { angle: 180, area: 'w', arrow: '←', label: 'left' }, { angle: 0, area: 'e', arrow: '→', label: 'right' },
    { angle: 225, area: 'sw', arrow: '↙', label: 'bottom left' }, { angle: 270, area: 's', arrow: '↓', label: 'bottom' }, { angle: 315, area: 'se', arrow: '↘', label: 'bottom right' },
  ];
  protected readonly shadowLooks = [{ value: 'soft', label: 'Soft' }, { value: 'hard', label: 'Hard' }, { value: 'lifted', label: 'Lifted' }];
  private readonly shadowPresets: Record<string, DesignShadow> = {
    soft: { x: 0, y: 4, blur: 12, strength: 0.3 }, hard: { x: 4, y: 4, blur: 0, strength: 0.5 }, lifted: { x: 0, y: 12, blur: 24, strength: 0.35 },
  };

  protected shadowLook(sh: DesignShadow): string | null {
    return Object.entries(this.shadowPresets).find(([, p]) => p.x === (sh.x ?? 0) && p.y === (sh.y ?? 4) && p.blur === (sh.blur ?? 8) && p.strength === (sh.strength ?? 0.35))?.[0] ?? null;
  }

  protected toggleShadow(on: boolean): void {
    this.changed.emit({ shadow: on ? { color: '#000000', ...this.shadowPresets['soft'] } : null });
  }

  protected shadowPreset(id: string): void {
    const sh = this.el().shadow;
    if (sh) this.changed.emit({ shadow: { ...sh, ...this.shadowPresets[id] } });
  }

  protected shadow(change: Partial<DesignShadow>): void {
    const sh = this.el().shadow;
    if (sh) this.changed.emit({ shadow: { ...sh, ...change } });
  }

  protected light(change: { angle?: number; color?: string | null }): void {
    const next = { angle: this.el().light?.angle ?? 135, color: this.el().light?.color ?? '#ffffff', ...change };
    // Back to the default light is no light setting at all.
    this.changed.emit({ light: next.angle === 135 && (next.color === '#ffffff' || !next.color) ? null : next });
  }

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

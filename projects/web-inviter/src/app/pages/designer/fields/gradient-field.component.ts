import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiNumberInput, UiSwitch } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { DesignStore } from '../design.store';
import type { DesignGradient } from '../model/scene';
import { resolveColor } from '../model/scene-ops';
import { GRADIENT_MAX_STOPS } from '../render/gradient';
import { ColorRefFieldComponent } from './color-ref-field.component';

const DIRECTIONS = [
  { value: '180', label: '↓' }, { value: '90', label: '→' }, { value: '135', label: '↘' }, { value: '45', label: '↗' },
];

/**
 * A gradient instead of a single colour: a switch, linear or radial, which way it runs, and its 2–6
 * colours (theme colours stay theme colours). A preview strip shows it.
 */
@Component({
  selector: 'app-gradient-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiNumberInput, UiSwitch, UiPanelSection, ColorRefFieldComponent],
  template: `
    <label class="switch"><ui-switch [ngModel]="!!value()" (ngModelChange)="toggle($event)" ariaLabel="Gradient" /> Gradient</label>
    @if (value(); as g) {
      <div class="strip" [style.background]="preview()" aria-hidden="true"></div>
      <ui-segmented size="sm" label="Kind" [options]="types" [value]="g.type ?? 'linear'" (valueChange)="$event !== null && set({ type: $any($event) })" />
      @if ((g.type ?? 'linear') === 'linear') {
        <ui-segmented size="sm" label="Direction" [options]="directions" [value]="named(g.angle ?? 180)" (valueChange)="$event !== null && set({ angle: +$event })" />
      }
      @for (s of g.stops; track $index; let i = $index) {
        <div class="stop">
          <app-color-ref-field [label]="'Colour ' + (i + 1)" [allowNone]="false" [value]="s.color" (changed)="setStop(i, $event)" />
          @if (g.stops.length > 2) {
            <ui-button size="sm" variant="ghost" (click)="removeStop(i)" [attr.aria-label]="'Remove colour ' + (i + 1)">Remove</ui-button>
          }
        </div>
      }
      @if (g.stops.length < max) {
        <ui-button size="sm" variant="outline" (click)="addStop()">Add a colour</ui-button>
      }
      @if ((g.type ?? 'linear') === 'linear') {
        <ui-panel-section title="Fine-tune (exact values)" [open]="false">
          <ui-number-input size="sm" label="Angle" suffix="°" [steppers]="false" [min]="0" [max]="360" [ngModel]="g.angle ?? 180"
            (ngModelChange)="$event !== null && set({ angle: $event })" ariaLabel="Gradient angle" />
        </ui-panel-section>
      }
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .switch { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
    .strip { height: 18px; border-radius: var(--ui-radius-sm); border: 1px solid var(--ui-color-border); }
    .stop { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 6px; }
  `,
})
export class GradientFieldComponent {
  private readonly store = inject(DesignStore);
  value = input<DesignGradient | null>(null);
  /** The colour it starts from when switched on (the element's own). */
  from = input<string | null>(null);
  changed = output<DesignGradient | null>();

  protected readonly types = [{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }];
  protected readonly directions = DIRECTIONS;
  protected readonly max = GRADIENT_MAX_STOPS;

  protected readonly preview = computed(() => {
    const g = this.value();
    const scene = this.store.scene();
    if (!g || !scene) return '';
    const stops = g.stops.map((s, i) => `${resolveColor(scene, s.color, '#000000')} ${Math.round((s.at ?? i / Math.max(1, g.stops.length - 1)) * 100)}%`).join(',');
    return `linear-gradient(90deg,${stops})`;
  });

  protected named(angle: number): string | null {
    return DIRECTIONS.find((d) => +d.value === angle)?.value ?? null;
  }

  protected toggle(on: boolean): void {
    if (!on) { this.changed.emit(null); return; }
    const theme = this.store.scene()?.theme.filter((t) => /^#/.test(t.value)) ?? [];
    const accent = theme.find((t) => t.key === 'accent') ? 'theme:accent' : theme[0] ? `theme:${theme[0].key}` : '#c0a060';
    const first = this.from() ?? accent;
    this.changed.emit({ type: 'linear', angle: 180, stops: [{ color: first }, { color: first === '#ffffff' ? accent : '#ffffff' }] });
  }

  protected set(change: Partial<DesignGradient>): void {
    const g = this.value();
    if (g) this.changed.emit({ ...g, ...change });
  }

  protected setStop(i: number, color: string | null): void {
    const g = this.value();
    if (!g || !color) return;
    this.changed.emit({ ...g, stops: g.stops.map((s, j) => (j === i ? { color } : { color: s.color })) });
  }

  protected addStop(): void {
    const g = this.value();
    if (g && g.stops.length < GRADIENT_MAX_STOPS) this.changed.emit({ ...g, stops: [...g.stops.map((s) => ({ color: s.color })), { color: g.stops[g.stops.length - 1].color }] });
  }

  protected removeStop(i: number): void {
    const g = this.value();
    if (g && g.stops.length > 2) this.changed.emit({ ...g, stops: g.stops.filter((_, j) => j !== i).map((s) => ({ color: s.color })) });
  }
}

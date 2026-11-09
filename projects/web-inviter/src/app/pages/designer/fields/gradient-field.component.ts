import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSlider, UiSwitch, UiFormField } from '@zouriel/ui/form';
import { DesignStore } from '../design.store';
import type { DesignGradient } from '../model/scene';
import { resolveColor } from '../model/scene-ops';
import { GRADIENT_MAX_STOPS } from '../render/gradient';
import { ColorRefFieldComponent } from './color-ref-field.component';

/**
 * A gradient instead of a single colour: a switch, linear or radial, which way it runs, and its 2–6
 * colours (theme colours stay theme colours). A preview strip shows it.
 */
@Component({
  selector: 'app-gradient-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiSlider, UiSwitch, ColorRefFieldComponent, UiFormField],
  template: `
    <label class="switch"><ui-switch [ngModel]="!!value()" (ngModelChange)="toggle($event)" ariaLabel="Gradient" /> Gradient</label>
    @if (value(); as g) {
      <div class="strip" [style.background]="preview()" aria-hidden="true"></div>
      <ui-segmented size="sm" label="Kind" [options]="types" [value]="g.type ?? 'linear'" (valueChange)="$event !== null && set({ type: $any($event) })" />
      @if ((g.type ?? 'linear') === 'linear') {
        <ui-form-field label="Direction"><ui-slider label="Direction" [min]="0" [max]="360" [step]="5" [ngModel]="g.angle ?? 180" (ngModelChange)="set({ angle: $event })" /></ui-form-field>
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
  protected readonly max = GRADIENT_MAX_STOPS;

  protected readonly preview = computed(() => {
    const g = this.value();
    const scene = this.store.scene();
    if (!g || !scene) return '';
    const stops = g.stops.map((s, i) => `${resolveColor(scene, s.color, '#000000')} ${Math.round((s.at ?? i / Math.max(1, g.stops.length - 1)) * 100)}%`).join(',');
    return `linear-gradient(90deg,${stops})`;
  });

  protected toggle(on: boolean): void {
    if (!on) { this.changed.emit(null); return; }
    const theme = this.store.scene()?.theme.filter((t) => /^#/.test(t.value)) ?? [];
    const accent = theme.find((t) => t.key === 'accent') ? 'theme:accent' : theme[0] ? `theme:${theme[0].key}` : '#c0a060';
    const text = theme.find((t) => t.key === 'text') ? 'theme:text' : '#333333';
    const first = this.from() ?? accent;
    // A second colour that shows against the page: the theme's text colour, or the accent.
    this.changed.emit({ type: 'linear', angle: 180, stops: [{ color: first }, { color: first === text ? accent : text }] });
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

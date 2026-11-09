import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSegmented } from '@zouriel/ui/button';
import { UiNumberInput } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import type { DesignParticles, ParticleKind, ParticlePointer } from '../model/scene';
import { ColorRefFieldComponent } from './color-ref-field.component';

interface ParticleTile { kind: ParticleKind; label: string }
interface NamedValue { value: string; label: string }

const AMOUNTS: NamedValue[] = [
  { value: '0.2', label: 'Few' },
  { value: '0.5', label: 'Some' },
  { value: '0.85', label: 'Lots' },
];
const SIZES: NamedValue[] = [
  { value: '0.2', label: 'Small' },
  { value: '0.5', label: 'Medium' },
  { value: '0.85', label: 'Large' },
];
const SPEEDS: NamedValue[] = [
  { value: '0.15', label: 'Calm' },
  { value: '0.4', label: 'Gentle' },
  { value: '0.8', label: 'Lively' },
];
const POINTERS: NamedValue[] = [
  { value: 'none', label: 'None' },
  { value: 'avoid', label: 'Move away' },
  { value: 'gather', label: 'Gather' },
  { value: 'swirl', label: 'Swirl' },
];

/** A shape's particle fill: visual kinds and named choices first, with exact numbers tucked away. */
@Component({
  selector: 'app-particles-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSegmented, UiNumberInput, UiPanelSection, ColorRefFieldComponent],
  template: `
    <div class="tiles" role="group" aria-label="Particles">
      <button type="button" class="tile none" [class.on]="!value()" (click)="changed.emit(null)"
        aria-label="None" [attr.aria-pressed]="!value()">
        <span class="name">None</span>
      </button>
      @for (tile of tiles; track tile.kind) {
        <button type="button" class="tile" [class.on]="value()?.kind === tile.kind" (click)="pick(tile.kind)"
          [attr.aria-label]="tile.label" [attr.aria-pressed]="value()?.kind === tile.kind" [title]="tile.label">
          <svg class="art" viewBox="0 0 40 28" aria-hidden="true">
            @switch (tile.kind) {
              @case ('dust') {
                <circle cx="8" cy="9" r="1.5"/><circle cx="17" cy="18" r="1"/><circle cx="26" cy="7" r="1"/><circle cx="33" cy="17" r="1.6"/><circle cx="8" cy="23" r="0.8"/>
              }
              @case ('stars') {
                <path d="M10 4l1.4 5.1L16 11l-4.6 1.9L10 18l-1.4-5.1L4 11l4.6-1.9L10 4zm18 2l1.1 4 3.9 1.5-3.9 1.5-1.1 4-1.1-4-3.9-1.5 3.9-1.5L28 6zm-7 11l.8 2.7 2.7.8-2.7.8L21 24l-.8-2.7-2.7-.8 2.7-.8L21 17z"/>
              }
              @case ('glitter') {
                <path d="M7 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zm14 2l1.4 4.1 4.1 1.4-4.1 1.4L21 18l-1.4-4.1-4.1-1.4 4.1-1.4L21 7zm11 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
              }
              @case ('snow') {
                <path d="M10 4v16M3 8l14 8M3 16l14-8M10 4L8 7m2-3l2 3m-2 13l-2-3m2 3l2-3M3 8l4 .5M3 8l2 3m12 5l-4-.5m4 .5l-2-3M3 16l4-.5M3 16l2-3m12-5l-4 .5m4-.5l-2 3M29 8v12m-5-9l10 6m-10 0l10-6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              }
              @case ('confetti') {
                <rect x="5" y="5" width="3" height="7" rx=".5" transform="rotate(-22 6.5 8.5)"/><rect x="16" y="15" width="3" height="7" rx=".5" transform="rotate(28 17.5 18.5)"/><rect x="28" y="5" width="3" height="7" rx=".5" transform="rotate(40 29.5 8.5)"/><rect x="32" y="19" width="3" height="6" rx=".5" transform="rotate(-28 33.5 22)"/>
              }
              @case ('hearts') {
                <path d="M11 21S4 16.5 4 11.5C4 8 8.5 7 11 10c2.5-3 7-2 7 1.5 0 5-7 9.5-7 9.5zm18-3s-5-3.2-5-6.8c0-2.5 3.2-3.2 5-1.1 1.8-2.1 5-1.4 5 1.1 0 3.6-5 6.8-5 6.8z"/>
              }
              @case ('bokeh') {
                <circle cx="9" cy="10" r="5" opacity=".28"/><circle cx="22" cy="17" r="7" opacity=".16"/><circle cx="33" cy="8" r="4" opacity=".4"/>
              }
              @case ('fireflies') {
                <circle cx="8" cy="17" r="5" opacity=".1"/><circle cx="8" cy="17" r="1.8"/><circle cx="22" cy="8" r="4" opacity=".12"/><circle cx="22" cy="8" r="1.4"/><circle cx="33" cy="19" r="5" opacity=".1"/><circle cx="33" cy="19" r="1.7"/>
              }
            }
          </svg>
          <span class="name">{{ tile.label }}</span>
        </button>
      }
    </div>

    @if (value(); as particles) {
      <p class="hint">Always drifting on its own. Add a pointer effect to make it answer the guest's finger or mouse.</p>
      <div class="colour">
        <app-color-ref-field label="Colour" [allowNone]="true" [value]="particles.color"
          (changed)="setColour($event)" />
        @if (!particles.color) {
          <span class="fill-note"><span class="fill-swatch" [style.background]="fill()" aria-hidden="true"></span>Uses the shape's fill</span>
        }
      </div>
      <ui-segmented size="sm" label="Amount" [options]="amounts" [value]="named(amounts, particles.amount ?? 0.5)"
        (valueChange)="$event !== null && set({ amount: +$event })" />
      <ui-segmented size="sm" label="Size" [options]="sizes" [value]="named(sizes, particles.size ?? 0.5)"
        (valueChange)="$event !== null && set({ size: +$event })" />
      <ui-segmented size="sm" label="Speed" [options]="speeds" [value]="named(speeds, particles.speed ?? 0.5)"
        (valueChange)="$event !== null && set({ speed: +$event })" />
      <ui-segmented size="sm" label="Pointer effect" [options]="pointers" [value]="particles.pointer ?? 'none'"
        (valueChange)="$event !== null && set({ pointer: $any($event) })" />
      <ui-panel-section title="Fine-tune (exact values)" [open]="false">
        <div class="grid2">
          <ui-number-input size="sm" label="Amount" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2"
            [ngModel]="particles.amount ?? 0.5" (ngModelChange)="$event !== null && set({ amount: $event })" ariaLabel="Amount exact value" />
          <ui-number-input size="sm" label="Size" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2"
            [ngModel]="particles.size ?? 0.5" (ngModelChange)="$event !== null && set({ size: $event })" ariaLabel="Size exact value" />
          <ui-number-input size="sm" label="Speed" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2"
            [ngModel]="particles.speed ?? 0.5" (ngModelChange)="$event !== null && set({ speed: $event })" ariaLabel="Speed exact value" />
        </div>
      </ui-panel-section>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--ui-space-2); }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
    .tile { display: grid; justify-items: center; gap: 3px; padding: 4px 2px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm);
      background: var(--ui-color-surface); color: var(--ui-color-text); cursor: pointer; min-width: 0; }
    .tile.on { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile.none { align-content: center; min-height: 54px; }
    .art { display: block; width: 40px; height: 28px; color: var(--ui-color-text-muted); fill: currentColor; }
    .name { font-size: 10px; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
    .hint { margin: 0; font-size: 11.5px; line-height: 1.4; color: var(--ui-color-text-muted); }
    .colour { display: grid; gap: var(--ui-space-1); }
    .fill-note { display: flex; align-items: center; gap: var(--ui-space-1); padding-left: 82px; font-size: 11px; color: var(--ui-color-text-muted); }
    .fill-swatch { width: 10px; height: 10px; border: 1px solid var(--ui-color-border-strong); border-radius: 50%; background: var(--ui-color-surface); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-2); }
  `,
})
export class ParticlesFieldComponent {
  value = input<DesignParticles | null>(null);
  fill = input<string | null>(null);
  changed = output<DesignParticles | null>();

  protected readonly tiles: readonly ParticleTile[] = [
    { kind: 'dust', label: 'Dust' },
    { kind: 'stars', label: 'Stars' },
    { kind: 'glitter', label: 'Glitter' },
    { kind: 'snow', label: 'Snow' },
    { kind: 'confetti', label: 'Confetti' },
    { kind: 'hearts', label: 'Hearts' },
    { kind: 'bokeh', label: 'Soft lights' },
    { kind: 'fireflies', label: 'Fireflies' },
  ];
  protected readonly amounts = AMOUNTS;
  protected readonly sizes = SIZES;
  protected readonly speeds = SPEEDS;
  protected readonly pointers = POINTERS;

  protected pick(kind: ParticleKind): void {
    this.changed.emit({ ...(this.value() ?? {}), kind });
  }

  protected set(change: Partial<DesignParticles>): void {
    const current = this.value();
    if (current) this.changed.emit({ ...current, ...change });
  }

  protected setColour(color: string | null): void {
    const current = this.value();
    if (!current) return;
    if (color === null) {
      const { color: _color, ...rest } = current;
      this.changed.emit(rest);
      return;
    }
    this.changed.emit({ ...current, color });
  }

  protected named(options: readonly NamedValue[], value: number): string | null {
    return options.find((option) => Math.abs(+option.value - value) <= 0.001)?.value ?? null;
  }
}

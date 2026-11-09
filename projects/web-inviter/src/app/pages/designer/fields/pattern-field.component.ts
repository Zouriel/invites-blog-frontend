import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSlider, UiFormField } from '@zouriel/ui/form';
import { DesignStore } from '../design.store';
import type { DesignPattern } from '../model/scene';
import { PATTERN_KINDS, patternFilter, resolvePattern } from '../render/patterns';
import { ColorRefFieldComponent } from './color-ref-field.component';

export const PATTERN_LABELS: Record<string, string> = {
  clouds: 'Clouds', marble: 'Marble', paper: 'Paper', linen: 'Linen', sand: 'Sand', watercolour: 'Watercolour', wood: 'Wood grain',
  dots: 'Polka dots', stripes: 'Stripes', pinstripe: 'Pinstripe', gingham: 'Gingham', grid: 'Grid', chevron: 'Zigzag',
  diamonds: 'Diamonds', waves: 'Waves', hearts: 'Hearts', stars: 'Stars',
};

const MODES = [
  { value: 'shade', label: 'Shade' }, { value: 'shine', label: 'Shine' }, { value: 'colour', label: 'Colour' },
  { value: 'emboss', label: 'Emboss' }, { value: 'engrave', label: 'Engrave' },
];
const MODE_HINTS: Record<string, string> = {
  shade: 'The pattern darkens the colour underneath.',
  shine: 'The pattern lightens the colour underneath.',
  colour: 'The pattern is painted in a second colour.',
  emboss: 'The pattern stands out of the surface, lit from the top left.',
  engrave: 'The pattern is pressed into the surface.',
};
export const PATTERN_SIZES = [{ value: '0.6', label: 'Small' }, { value: '1', label: 'Medium' }, { value: '1.8', label: 'Large' }];
export const PATTERN_STRENGTHS = [{ value: '0.25', label: 'Subtle' }, { value: '0.5', label: 'Medium' }, { value: '0.8', label: 'Strong' }];

/**
 * A pattern over whatever an element paints: which one (tiles that show it), how it applies to the
 * colour (shade, shine, a second colour, emboss, engrave), how big and how strong. Named sizes and
 * strengths first; exact numbers sit in a closed Fine-tune.
 */
@Component({
  selector: 'app-pattern-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiSlider, ColorRefFieldComponent, UiFormField],
  template: `
    <div class="tiles" role="group" aria-label="Pattern">
      <button type="button" class="tile none" [class.on]="!value()" (click)="changed.emit(null)" aria-label="No pattern" [attr.aria-pressed]="!value()">
        <span class="name">None</span>
      </button>
      @for (t of tiles(); track t.kind) {
        <button type="button" class="tile" [class.on]="value()?.kind === t.kind" (click)="pick(t.kind)"
          [attr.aria-label]="t.label" [attr.aria-pressed]="value()?.kind === t.kind" [title]="t.label">
          <span class="art" [innerHTML]="t.svg"></span>
          <span class="name">{{ t.label }}</span>
        </button>
      }
    </div>
    @if (value(); as p) {
      <ui-segmented size="sm" label="How it applies" [options]="modes" [value]="p.mode ?? 'shade'" (valueChange)="set({ mode: $any($event) })" />
      <p class="hint">{{ modeHint() }}</p>
      @if ((p.mode ?? 'shade') === 'colour') {
        <app-color-ref-field label="Pattern colour" [allowNone]="false" [value]="p.color ?? null" (changed)="set({ color: $event })" />
      }
      <ui-form-field label="Size"><ui-slider label="Size" [min]="minSize" [max]="maxSize" [step]="0.05" [ngModel]="p.size ?? 1" (ngModelChange)="set({ size: $event })" /></ui-form-field>
      <ui-form-field label="Strength"><ui-slider label="Strength" [min]="0" [max]="100" [step]="1" [ngModel]="(p.strength ?? 0.5) * 100" (ngModelChange)="set({ strength: $event / 100 })" /></ui-form-field>
      <ui-button size="sm" variant="outline" (click)="changed.emit(null)">Remove pattern</ui-button>
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
    .tile { display: grid; justify-items: center; gap: 3px; padding: 4px 2px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm);
      background: var(--ui-color-surface); color: var(--ui-color-text); cursor: pointer; min-width: 0; }
    .tile.on { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile.none { align-content: center; min-height: 62px; }
    .art { display: block; width: 40px; height: 40px; line-height: 0; }
    .name { font-size: 10px; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class PatternFieldComponent {
  private readonly store = inject(DesignStore);
  private readonly sanitizer = inject(DomSanitizer);
  value = input<DesignPattern | null>(null);
  changed = output<DesignPattern | null>();

  protected readonly modes = MODES;
  protected readonly minSize = 0.25;
  protected readonly maxSize = 2.5;
  protected readonly modeHint = computed(() => MODE_HINTS[this.value()?.mode ?? 'shade'] ?? '');

  /** Each pattern drawn small: dark marks on a light tile (raised or pressed in when that's the way chosen). */
  protected readonly tiles = computed(() => {
    const chosen = this.value()?.mode;
    const mode = chosen === 'emboss' || chosen === 'engrave' ? chosen : 'shade';
    return PATTERN_KINDS.map((kind) => {
      const p = resolvePattern({ kind, mode, size: 0.6, strength: mode === 'shade' ? 0.7 : 0.9 })!;
      const id = `pv-${kind}`;
      const svg = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><defs>${patternFilter(id, p, 40, 40, null)}</defs>`
        + `<rect width="40" height="40" rx="8" fill="${mode === 'shade' ? '#d8cbb3' : '#9a8a74'}" filter="url(#${id})"/></svg>`;
      return { kind, label: PATTERN_LABELS[kind] ?? kind, svg: this.sanitizer.bypassSecurityTrustHtml(svg) as SafeHtml };
    });
  });

  protected pick(kind: string): void {
    const v = this.value();
    this.changed.emit({ mode: 'shade', size: 1, strength: 0.5, ...(v ?? {}), kind });
  }

  protected set(change: Partial<DesignPattern>): void {
    const v = this.value();
    if (!v) return;
    const next = { ...v, ...change };
    // The colour way starts in a theme colour (the accent if there is one), not black.
    if (next.mode === 'colour' && !next.color) {
      const theme = this.store.scene()?.theme.filter((t) => /^#/.test(t.value)) ?? [];
      const key = (theme.find((t) => t.key === 'accent') ?? theme[0])?.key;
      if (key) next.color = `theme:${key}`;
    }
    this.changed.emit(next);
  }
}

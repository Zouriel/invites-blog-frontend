import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiChoiceGrid, UiNumberInput, type UiChoice } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { DesignStore } from './design.store';
import {
  BLOB_STYLES, DEFAULTS, SCATTER_COUNTS, SCATTER_SIZES, VINE_CURLS, VINE_LEAVES, VINE_LENGTHS,
  generate, generatedOf, newSeed, type GeneratorKind, type GeneratorOptions,
} from './model/generators';
import { miniSvg } from './model/mini-svg';

type Opt<K extends GeneratorKind> = Extract<GeneratorOptions, { kind: K }>;

const KINDS: UiChoice[] = [
  { value: 'blob', label: 'Blob', description: 'A soft organic shape' },
  { value: 'vine', label: 'Vine', description: 'A curling stem with leaves' },
];

const seg = (o: Record<string, unknown>, labels: Record<string, string>) => Object.keys(o).map((k) => ({ value: k, label: labels[k] ?? k }));
const nameOf = <T,>(o: Record<string, T>, v: T, eq: (a: T, b: T) => boolean = (a, b) => a === b): string | null =>
  Object.entries(o).find(([, x]) => eq(x, v))?.[0] ?? null;

const BLOB_SIZES = { small: 140, medium: 220, large: 320 } as const;
const LEAF_SIZES = { small: 28, medium: 44, large: 64 } as const;

/**
 * Generators: a scatter, a blob or a vine, made from a seed in the theme's colours. Named one-tap choices
 * first, exact numbers in a closed Fine-tune. With nothing generated selected, the choices shape what Add
 * will make (shown in the preview); with a generated thing selected, they change it where it is, and
 * Shuffle makes it again from a new seed.
 */
@Component({
  selector: 'app-generator-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiChoiceGrid, UiNumberInput, UiPanelSection],
  template: `
    @if (!editing()) {
      <p class="lead">Made for you from a seed, in your colours: plain shapes you can then move, recolour or ungroup.</p>
      <ui-choice-grid label="Make" [options]="kinds" [value]="kind()" minTile="92px" (valueChange)="$event && kind.set($any($event))">
        <ng-template #tile let-item>
          <span class="art small" [innerHTML]="tiles().get(item.value)"></span>
        </ng-template>
      </ui-choice-grid>
    } @else {
      <p class="lead">Changes here make the selected {{ kind() }} again where it is. Shuffle for another one.</p>
    }

    @switch (kind()) {
      @case ('scatter') {
        @if (scatter(); as o) {
          <div class="field"><span class="label">What</span><ui-segmented size="sm" label="What" [options]="shapes" [value]="o.shape" (valueChange)="$event && set({ shape: $any($event) })" /></div>
          <div class="field"><span class="label">How many</span><ui-segmented size="sm" label="How many" [options]="counts" [value]="name(scatterCounts, o.count)" (valueChange)="$event && set({ count: scatterCounts[$any($event)] })" /></div>
          <div class="field"><span class="label">Size</span><ui-segmented size="sm" label="Size" [options]="sizes" [value]="sizeName(o.minSize, o.maxSize)" (valueChange)="$event && setSize($any($event))" /></div>
          <div class="field"><span class="label">Where</span><ui-segmented size="sm" label="Where" [options]="areas" [value]="o.area" (valueChange)="$event && set({ area: $any($event) })" /></div>
        }
      }
      @case ('blob') {
        @if (blob(); as o) {
          <div class="field"><span class="label">Style</span><ui-segmented size="sm" label="Style" [options]="blobStyles" [value]="blobStyle(o.points, o.wobble)" (valueChange)="$event && setBlobStyle($any($event))" /></div>
          <div class="field"><span class="label">Size</span><ui-segmented size="sm" label="Size" [options]="blobSizes" [value]="name(blobSizeMap, o.size)" (valueChange)="$event && set({ size: blobSizeMap[$any($event)] })" /></div>
        }
      }
      @case ('vine') {
        @if (vine(); as o) {
          <div class="field"><span class="label">Leaves</span><ui-segmented size="sm" label="Leaves" [options]="leafCounts" [value]="name(vineLeaves, o.leaves)" (valueChange)="$event && set({ leaves: vineLeaves[$any($event)] })" /></div>
          <div class="field"><span class="label">Curl</span><ui-segmented size="sm" label="Curl" [options]="curls" [value]="name(vineCurls, o.curl)" (valueChange)="$event && set({ curl: vineCurls[$any($event)] })" /></div>
          <div class="field"><span class="label">Length</span><ui-segmented size="sm" label="Length" [options]="lengths" [value]="name(vineLengths, o.length)" (valueChange)="$event && set({ length: vineLengths[$any($event)] })" /></div>
          <div class="field"><span class="label">Grows</span><ui-segmented size="sm" label="Grows" [options]="directions" [value]="o.direction" (valueChange)="$event && set({ direction: $any($event) })" /></div>
          <div class="field"><span class="label">Leaf size</span><ui-segmented size="sm" label="Leaf size" [options]="leafSizes" [value]="name(leafSizeMap, o.leafSize)" (valueChange)="$event && set({ leafSize: leafSizeMap[$any($event)] })" /></div>
        }
      }
    }

    @if (!editing()) {
      <span class="art preview" [innerHTML]="preview()" aria-hidden="true"></span>
    }
    <div class="actions">
      @if (editing()) {
        <ui-button size="sm" variant="primary" (click)="shuffle()">Shuffle</ui-button>
        <ui-button size="sm" variant="outline" (click)="addNew()">Add another</ui-button>
      } @else {
        <ui-button size="sm" variant="primary" (click)="addNew()">Add to the page</ui-button>
        <ui-button size="sm" variant="outline" (click)="seed.set(newSeed())">Shuffle</ui-button>
      }
    </div>

    <ui-panel-section title="Fine-tune (exact values)" [open]="false">
      <div class="grid2">
        @switch (kind()) {
          @case ('scatter') {
            @if (scatter(); as o) {
              <ui-number-input size="sm" label="How many" [steppers]="true" [min]="1" [max]="120" [ngModel]="o.count" (ngModelChange)="$event !== null && set({ count: $event }, true)" ariaLabel="How many" />
              <ui-number-input size="sm" label="Smallest" [steppers]="false" [min]="2" [max]="120" [ngModel]="o.minSize" (ngModelChange)="$event !== null && set({ minSize: $event }, true)" ariaLabel="Smallest size" />
              <ui-number-input size="sm" label="Biggest" [steppers]="false" [min]="2" [max]="160" [ngModel]="o.maxSize" (ngModelChange)="$event !== null && set({ maxSize: $event }, true)" ariaLabel="Biggest size" />
            }
          }
          @case ('blob') {
            @if (blob(); as o) {
              <ui-number-input size="sm" label="Bumps" [steppers]="true" [min]="4" [max]="14" [ngModel]="o.points" (ngModelChange)="$event !== null && set({ points: $event }, true)" ariaLabel="Bumps round the edge" />
              <ui-number-input size="sm" label="Wobble" [steppers]="false" [min]="0" [max]="0.6" [step]="0.05" [precision]="2" [ngModel]="o.wobble" (ngModelChange)="$event !== null && set({ wobble: $event }, true)" ariaLabel="Wobble, 0 round to 0.6 wild" />
              <ui-number-input size="sm" label="Size" [steppers]="false" [min]="20" [max]="800" [ngModel]="o.size" (ngModelChange)="$event !== null && set({ size: $event }, true)" ariaLabel="Size across" />
            }
          }
          @case ('vine') {
            @if (vine(); as o) {
              <ui-number-input size="sm" label="Leaves" [steppers]="true" [min]="0" [max]="40" [ngModel]="o.leaves" (ngModelChange)="$event !== null && set({ leaves: $event }, true)" ariaLabel="Leaves" />
              <ui-number-input size="sm" label="Curl" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2" [ngModel]="o.curl" (ngModelChange)="$event !== null && set({ curl: $event }, true)" ariaLabel="Curl, 0 straight to 1 curly" />
              <ui-number-input size="sm" label="Length" [steppers]="false" [min]="80" [max]="1600" [ngModel]="o.length" (ngModelChange)="$event !== null && set({ length: $event }, true)" ariaLabel="Length" />
              <ui-number-input size="sm" label="Leaf size" [steppers]="false" [min]="8" [max]="120" [ngModel]="o.leafSize" (ngModelChange)="$event !== null && set({ leafSize: $event }, true)" ariaLabel="Leaf size" />
            }
          }
        }
        <ui-number-input size="sm" label="Seed" [steppers]="false" [min]="0" [max]="999999" [ngModel]="currentSeed()" (ngModelChange)="$event !== null && setSeed($event)" ariaLabel="Seed" />
      </div>
      <p class="hint">The same seed and settings always make the same one.</p>
    </ui-panel-section>
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .lead, .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .art { display: block; line-height: 0; color: var(--ui-color-primary); }
    .art :is(svg) { width: 100%; height: 100%; }
    .art.small { width: 100%; aspect-ratio: 1; }
    .art.preview { height: 160px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm); padding: 4px; background: var(--preview-bg, var(--ui-color-surface)); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .field { display: grid; gap: 4px; }
    .label { font-size: 12px; font-weight: 600; color: var(--ui-color-text-muted); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
  host: { '[style.--preview-bg]': 'pageBg()' },
})
export class GeneratorPanelComponent {
  private readonly store = inject(DesignStore);
  private readonly sanitizer = inject(DomSanitizer);
  /** Something was added (the phone layout may close its panel). */
  readonly added = output<void>();

  protected readonly kinds = KINDS;
  protected readonly newSeed = newSeed;
  protected readonly kind = signal<GeneratorKind>('blob');
  protected readonly seed = signal(newSeed());
  private readonly draft = signal<Record<GeneratorKind, GeneratorOptions>>({ scatter: DEFAULTS.scatter, blob: DEFAULTS.blob, vine: DEFAULTS.vine });

  /** The selected generated element, when there is one: the panel edits it. */
  protected readonly target = computed(() => {
    const el = this.store.primary();
    const made = generatedOf(el);
    return el && made && this.store.selection().length === 1 ? { el, ...made } : null;
  });
  protected readonly editing = computed(() => !!this.target());

  constructor() {
    effect(() => {
      const t = this.target();
      if (t) untracked(() => this.kind.set(t.options.kind));
    });
  }

  protected readonly options = computed<GeneratorOptions>(() => this.target()?.options ?? this.draft()[this.kind()]);
  protected readonly currentSeed = computed(() => this.target()?.seed ?? this.seed());
  protected readonly scatter = computed(() => { const o = this.options(); return o.kind === 'scatter' ? o : null; });
  protected readonly blob = computed(() => { const o = this.options(); return o.kind === 'blob' ? o : null; });
  protected readonly vine = computed(() => { const o = this.options(); return o.kind === 'vine' ? o : null; });

  protected readonly pageBg = computed(() => this.store.scene()?.theme.find((t) => t.key === 'bg')?.value ?? null);

  // Named choices.
  protected readonly shapes = seg({ dots: 0, stars: 0, hearts: 0, confetti: 0 }, { dots: 'Dots', stars: 'Stars', hearts: 'Hearts', confetti: 'Confetti' });
  protected readonly scatterCounts: Record<string, number> = SCATTER_COUNTS;
  protected readonly counts = seg(SCATTER_COUNTS, { few: 'Few', some: 'Some', lots: 'Lots' });
  protected readonly sizes = seg(SCATTER_SIZES, { small: 'Small', medium: 'Medium', large: 'Large' });
  protected readonly areas = seg({ screen: 0, top: 0, bottom: 0, edges: 0 }, { screen: 'Everywhere', top: 'Top', bottom: 'Bottom', edges: 'Round the edge' });
  protected readonly blobStyles = seg(BLOB_STYLES, { smooth: 'Smooth', wavy: 'Wavy', wild: 'Wild' });
  protected readonly blobSizeMap: Record<string, number> = BLOB_SIZES;
  protected readonly blobSizes = seg(BLOB_SIZES, { small: 'Small', medium: 'Medium', large: 'Large' });
  protected readonly vineLeaves: Record<string, number> = VINE_LEAVES;
  protected readonly leafCounts = seg(VINE_LEAVES, { few: 'Few', some: 'Some', lots: 'Lots' });
  protected readonly vineCurls: Record<string, number> = VINE_CURLS;
  protected readonly curls = seg(VINE_CURLS, { straight: 'Straight', gentle: 'Gentle', curly: 'Curly' });
  protected readonly vineLengths: Record<string, number> = VINE_LENGTHS;
  protected readonly lengths = seg(VINE_LENGTHS, { short: 'Short', medium: 'Medium', long: 'Long' });
  protected readonly directions = seg({ up: 0, across: 0, down: 0 }, { up: 'Up', across: 'Across', down: 'Hanging' });
  protected readonly leafSizeMap: Record<string, number> = LEAF_SIZES;
  protected readonly leafSizes = seg(LEAF_SIZES, { small: 'Small', medium: 'Medium', large: 'Large' });

  protected name(map: Record<string, number>, v: number): string | null {
    return nameOf(map, v, (a, b) => Math.abs(a - b) < 1e-6);
  }
  protected sizeName(min: number, max: number): string | null {
    return nameOf(SCATTER_SIZES as Record<string, readonly [number, number]>, [min, max] as const, (a, b) => a[0] === b[0] && a[1] === b[1]);
  }
  protected blobStyle(points: number, wobble: number): string | null {
    return nameOf(BLOB_STYLES as Record<string, { points: number; wobble: number }>, { points, wobble }, (a, b) => a.points === b.points && Math.abs(a.wobble - b.wobble) < 1e-6);
  }

  protected setSize(name: keyof typeof SCATTER_SIZES): void {
    const [minSize, maxSize] = SCATTER_SIZES[name];
    this.set({ minSize, maxSize });
  }
  protected setBlobStyle(name: keyof typeof BLOB_STYLES): void {
    this.set({ ...BLOB_STYLES[name] });
  }

  /** Changes options: the selected one is made again (typed numbers fold into one undo step), else the draft. */
  protected set(patch: Partial<Opt<'scatter'>> | Partial<Opt<'blob'>> | Partial<Opt<'vine'>>, typed = false): void {
    const next = { ...this.options(), ...patch } as GeneratorOptions;
    const t = this.target();
    if (t) this.store.regenerate(t.el.id, { options: next }, typed ? `${t.el.id}:generate` : undefined);
    else this.draft.update((d) => ({ ...d, [next.kind]: next }));
  }

  protected setSeed(seed: number): void {
    const t = this.target();
    if (t) this.store.regenerate(t.el.id, { seed: Math.round(seed) }, `${t.el.id}:seed`);
    else this.seed.set(Math.round(seed));
  }

  protected shuffle(): void {
    const t = this.target();
    if (t) this.store.regenerate(t.el.id, { seed: newSeed() });
  }

  protected addNew(): void {
    const options = this.target()?.options ?? this.options();
    if (this.store.addGenerated(options, this.target() ? newSeed() : this.seed())) {
      this.seed.set(newSeed());
      this.added.emit();
    }
  }

  /** The kind tiles: each kind's default, drawn small. */
  protected readonly tiles = computed(() => {
    const scene = this.store.scene();
    const out = new Map<string, SafeHtml>();
    if (!scene) return out;
    for (const k of ['scatter', 'blob', 'vine'] as const)
      out.set(k, this.sanitizer.bypassSecurityTrustHtml(miniSvg(scene, generate(scene, k === 'scatter' ? { ...DEFAULTS.scatter, count: 14, minSize: 26, maxSize: 46, area: 'top' } : DEFAULTS[k], 7))));
    return out;
  });

  /** What Add will make, from the choices and seed. */
  protected readonly preview = computed(() => {
    const scene = this.store.scene();
    if (!scene) return '';
    const el = generate(scene, this.options(), this.seed());
    return this.sanitizer.bypassSecurityTrustHtml(miniSvg(scene, el, el.type === 'group' && this.options().kind === 'scatter' ? 0 : 8));
  });
}

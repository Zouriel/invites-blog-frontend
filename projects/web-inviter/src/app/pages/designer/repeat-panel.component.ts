import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiChoiceGrid, UiNumberInput, UiSwitch, type UiChoice } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { DesignStore } from './design.store';
import type { DesignElement } from './model/scene';
import { DIRECTIONS, GAPS, repeatOf, repeatPlaces, ringRadius, type RepeatSpec, type RingSpacing } from './model/repeat';

type Layout = RepeatSpec['kind'];

interface Preset { value: string; label: string; description: string; spec: (el: DesignElement) => RepeatSpec }

const circle = (count: number, spacing: RingSpacing) => (el: DesignElement): RepeatSpec =>
  ({ kind: 'circle', count, radius: ringRadius(el, count, spacing), faceOut: true, startAngle: 0 });
const grid = (columns: number, rows: number, gap: keyof typeof GAPS = 'small') => (): RepeatSpec =>
  ({ kind: 'grid', columns, rows, gapX: GAPS[gap], gapY: GAPS[gap] });
const row = (count: number, direction: keyof typeof DIRECTIONS, gap: keyof typeof GAPS = 'small') => (): RepeatSpec =>
  ({ kind: 'line', count, spacing: GAPS[gap], angle: DIRECTIONS[direction] });

/** One tap each: the layouts people reach for. Exact numbers are in Fine-tune. */
const PRESETS: Record<Layout, Preset[]> = {
  circle: [
    { value: 'flower6', label: 'Flower of 6', description: 'Meet in the middle', spec: circle(6, 'petals') },
    { value: 'flower8', label: 'Flower of 8', description: 'Meet in the middle', spec: circle(8, 'petals') },
    { value: 'flower12', label: 'Flower of 12', description: 'Meet in the middle', spec: circle(12, 'petals') },
    { value: 'ring8', label: 'Ring of 8', description: 'A wreath round a gap', spec: circle(8, 'ring') },
    { value: 'ring12', label: 'Ring of 12', description: 'A wreath round a gap', spec: circle(12, 'ring') },
    { value: 'sun12', label: 'Sun of 12', description: 'Rays round a wide middle', spec: circle(12, 'wide') },
  ],
  grid: [
    { value: 'g2', label: '2 × 2', description: 'Small gaps', spec: grid(2, 2) },
    { value: 'g3', label: '3 × 3', description: 'Small gaps', spec: grid(3, 3) },
    { value: 'g4', label: '4 × 4', description: 'Small gaps', spec: grid(4, 4) },
    { value: 'g3t', label: '3 × 3', description: 'Touching', spec: grid(3, 3, 'none') },
    { value: 'g2w', label: '2 × 3', description: 'Wide gaps', spec: grid(2, 3, 'wide') },
    { value: 'g5', label: '5 × 5', description: 'Touching', spec: grid(5, 5, 'none') },
  ],
  line: [
    { value: 'a3', label: '3 across', description: 'Small gaps', spec: row(3, 'across') },
    { value: 'a5', label: '5 across', description: 'Small gaps', spec: row(5, 'across') },
    { value: 'a5t', label: '5 across', description: 'Touching', spec: row(5, 'across', 'none') },
    { value: 'd3', label: '3 down', description: 'Small gaps', spec: row(3, 'down') },
    { value: 'd5', label: '5 down', description: 'Wide gaps', spec: row(5, 'down', 'wide') },
    { value: 'x4', label: '4 slanting', description: 'Corner to corner', spec: row(4, 'diagonal') },
  ],
};

const LAYOUTS = [{ value: 'circle', label: 'Around' }, { value: 'grid', label: 'Grid' }, { value: 'line', label: 'Line' }];

/**
 * Repeat the selected element: around a circle (a flower, a wreath, a sun), in a grid or along a line.
 * A tap on a layout does it; the original and its copies become one group. With that group selected,
 * another tap lays the original out again instead of repeating the group.
 */
@Component({
  selector: 'app-repeat-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiChoiceGrid, UiNumberInput, UiSwitch, UiPanelSection],
  template: `
    @if (el(); as el) {
      @if (current()) {
        <p class="hint">These are repeats of its first piece. Pick another layout to lay them out again.</p>
      } @else {
        <p class="hint">Copies of it, laid out together as one group. Ungroup later to change one on its own.</p>
      }
      <ui-segmented size="sm" label="Lay copies out" [options]="layouts" [value]="layout()" (valueChange)="$event && layout.set($any($event))" />
      <ui-choice-grid [label]="'Repeat ' + layout()" [options]="choices()" [value]="null" minTile="92px" (picked)="apply($event.value)">
        <ng-template #tile let-item>
          <span class="art" [innerHTML]="previews().get(item.value)"></span>
        </ng-template>
      </ui-choice-grid>
      <ui-panel-section title="Fine-tune (exact values)" [open]="false">
        <div class="grid2">
          @switch (layout()) {
            @case ('circle') {
              <ui-number-input size="sm" label="How many" [steppers]="true" [min]="2" [max]="60" [ngModel]="count()" (ngModelChange)="count.set($event ?? 2)" ariaLabel="How many around" />
              <ui-number-input size="sm" label="Radius" [steppers]="false" [min]="0" [max]="2000" [ngModel]="radius()" (ngModelChange)="radius.set($event ?? 0)" ariaLabel="Circle radius" />
              <ui-number-input size="sm" label="Start angle" [steppers]="false" [min]="-360" [max]="360" [ngModel]="startAngle()" (ngModelChange)="startAngle.set($event ?? 0)" ariaLabel="Start angle in degrees" />
              <ui-switch size="sm" [ngModel]="faceOut()" (ngModelChange)="faceOut.set($event)">Turn to face out</ui-switch>
            }
            @case ('grid') {
              <ui-number-input size="sm" label="Columns" [steppers]="true" [min]="1" [max]="30" [ngModel]="columns()" (ngModelChange)="columns.set($event ?? 1)" ariaLabel="Columns" />
              <ui-number-input size="sm" label="Rows" [steppers]="true" [min]="1" [max]="30" [ngModel]="rows()" (ngModelChange)="rows.set($event ?? 1)" ariaLabel="Rows" />
              <ui-number-input size="sm" label="Gap across" [steppers]="false" [min]="-500" [max]="500" [ngModel]="gapX()" (ngModelChange)="gapX.set($event ?? 0)" ariaLabel="Gap across" />
              <ui-number-input size="sm" label="Gap down" [steppers]="false" [min]="-500" [max]="500" [ngModel]="gapY()" (ngModelChange)="gapY.set($event ?? 0)" ariaLabel="Gap down" />
            }
            @case ('line') {
              <ui-number-input size="sm" label="How many" [steppers]="true" [min]="2" [max]="60" [ngModel]="count()" (ngModelChange)="count.set($event ?? 2)" ariaLabel="How many in the line" />
              <ui-number-input size="sm" label="Gap" [steppers]="false" [min]="-500" [max]="1000" [ngModel]="spacing()" (ngModelChange)="spacing.set($event ?? 0)" ariaLabel="Gap between copies" />
              <ui-number-input size="sm" label="Direction" [steppers]="false" [min]="-360" [max]="360" [ngModel]="angle()" (ngModelChange)="angle.set($event ?? 0)" ariaLabel="Direction in degrees, 0 across, 90 down" />
            }
          }
        </div>
        <ui-button size="sm" variant="outline" (click)="applyExact()">{{ current() ? 'Lay out again' : 'Repeat' }}</ui-button>
      </ui-panel-section>
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .art { display: block; width: 100%; aspect-ratio: 1; line-height: 0; color: var(--ui-color-primary); }
    .art :is(svg) { width: 100%; height: 100%; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; }
  `,
})
export class RepeatPanelComponent {
  private readonly store = inject(DesignStore);
  private readonly sanitizer = inject(DomSanitizer);
  /** What to repeat (default: the selection). */
  readonly element = input<DesignElement | null>(null);
  protected readonly el = computed(() => this.element() ?? this.store.primary());
  /** When the selection is a repeat group, how it was laid out. */
  protected readonly current = computed(() => repeatOf(this.el()));
  /** The piece repeated: a repeat group's first one, else the element. */
  private readonly piece = computed(() => {
    const el = this.el();
    return this.current() ? el!.children![0] : el;
  });

  protected readonly layouts = LAYOUTS;
  protected readonly layout = signal<Layout>('circle');
  protected readonly count = signal(8);
  protected readonly radius = signal(60);
  protected readonly startAngle = signal(0);
  protected readonly faceOut = signal(true);
  protected readonly columns = signal(3);
  protected readonly rows = signal(3);
  protected readonly gapX = signal<number>(GAPS.small);
  protected readonly gapY = signal<number>(GAPS.small);
  protected readonly spacing = signal<number>(GAPS.small);
  protected readonly angle = signal(0);

  constructor() {
    // Fine-tune starts from what the selection has (a repeat group's own numbers), or from sensible ones for its size.
    effect(() => {
      const piece = this.piece();
      const spec = this.current();
      if (!piece) return;
      untracked(() => {
        if (spec) this.load(spec);
        else this.radius.set(ringRadius(piece, this.count(), 'petals'));
      });
    });
  }

  private load(spec: RepeatSpec): void {
    this.layout.set(spec.kind);
    if (spec.kind === 'circle') {
      this.count.set(spec.count); this.radius.set(spec.radius); this.startAngle.set(spec.startAngle); this.faceOut.set(spec.faceOut);
    } else if (spec.kind === 'grid') {
      this.columns.set(spec.columns); this.rows.set(spec.rows); this.gapX.set(spec.gapX); this.gapY.set(spec.gapY);
    } else {
      this.count.set(spec.count); this.spacing.set(spec.spacing); this.angle.set(spec.angle);
    }
  }

  protected readonly choices = computed<UiChoice[]>(() => PRESETS[this.layout()].map((p) => ({ value: p.value, label: p.label, description: p.description })));

  /** Each layout drawn small with the element's proportions: its outline in each place it would go. */
  protected readonly previews = computed(() => {
    const out = new Map<string, SafeHtml>();
    const piece = this.piece();
    if (!piece) return out;
    for (const p of PRESETS[this.layout()]) out.set(p.value, this.sanitizer.bypassSecurityTrustHtml(previewSvg(piece, p.spec(piece))));
    return out;
  });

  protected apply(value: string): void {
    const piece = this.piece();
    const preset = PRESETS[this.layout()].find((p) => p.value === value);
    const el = this.el();
    if (!piece || !preset || !el) return;
    const spec = preset.spec(piece);
    this.load(spec);
    this.store.repeat(el.id, spec);
  }

  protected applyExact(): void {
    const el = this.el();
    if (!el) return;
    const spec: RepeatSpec = this.layout() === 'circle'
      ? { kind: 'circle', count: this.count(), radius: this.radius(), faceOut: this.faceOut(), startAngle: this.startAngle() }
      : this.layout() === 'grid'
        ? { kind: 'grid', columns: this.columns(), rows: this.rows(), gapX: this.gapX(), gapY: this.gapY() }
        : { kind: 'line', count: this.count(), spacing: this.spacing(), angle: this.angle() };
    this.store.repeat(el.id, spec);
  }
}

/** A layout drawn as the element's outline (an oval for a petal-ish piece, a box otherwise) in each place. */
function previewSvg(el: DesignElement, spec: RepeatSpec): string {
  const w = el.w * el.scale;
  const h = el.h * el.scale;
  const places = repeatPlaces(el, spec);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const r = Math.max(w, h) / 2;
  for (const p of places) {
    x0 = Math.min(x0, p.dx - r); y0 = Math.min(y0, p.dy - r); x1 = Math.max(x1, p.dx + r); y1 = Math.max(y1, p.dy + r);
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  const size = Math.max(x1 - x0, y1 - y0) + pad * 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const round = el.type === 'shape' && (el.shape?.kind === 'ellipse' || el.shape?.kind === 'path');
  const marks = places.map((p, i) => {
    const t = `translate(${p.dx} ${p.dy}) rotate(${el.rotate + p.turn})`;
    const fill = `fill="currentColor" opacity="${i === 0 ? 1 : 0.55}"`;
    return round
      ? `<ellipse transform="${t}" rx="${w / 2}" ry="${h / 2}" ${fill}/>`
      : `<rect transform="${t}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.12}" ${fill}/>`;
  }).join('');
  const f = (v: number) => Math.round(v * 100) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(cx - size / 2)} ${f(cy - size / 2)} ${f(size)} ${f(size)}" aria-hidden="true">${marks}</svg>`;
}

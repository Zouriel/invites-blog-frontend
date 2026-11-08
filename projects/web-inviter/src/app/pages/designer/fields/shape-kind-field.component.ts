import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { UiSegmented } from '@zouriel/ui/button';
import { UiNumberInput } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { SHAPE_AMOUNT, SHAPE_COUNT, shapeD } from '../render/shapes';

export const SHAPE_LABELS: Record<string, string> = {
  rect: 'Box', ellipse: 'Oval', line: 'Line', polygon: 'Polygon', star: 'Star', heart: 'Heart', arch: 'Arch', ribbon: 'Banner',
  bubble: 'Speech bubble', arrow: 'Arrow', scallop: 'Badge', wave: 'Wave edge', zigzag: 'Zigzag edge', frame: 'Frame', ticket: 'Ticket', path: 'Drawn',
};

/** Named settings for each kind's own amount: three tiles, exact numbers in Fine-tune. */
const AMOUNT_PRESETS: Record<string, { value: string; label: string }[]> = {
  star: [{ value: '0.3', label: 'Shallow' }, { value: '0.5', label: 'Medium' }, { value: '0.75', label: 'Deep' }],
  ribbon: [{ value: '0.25', label: 'Small' }, { value: '0.5', label: 'Medium' }, { value: '0.85', label: 'Deep' }],
  bubble: [{ value: '0.1', label: 'Left' }, { value: '0.5', label: 'Middle' }, { value: '0.9', label: 'Right' }],
  arrow: [{ value: '0.25', label: 'Thin' }, { value: '0.45', label: 'Medium' }, { value: '0.7', label: 'Thick' }],
  scallop: [{ value: '0.06', label: 'Soft' }, { value: '0.12', label: 'Medium' }, { value: '0.25', label: 'Deep' }],
  wave: [{ value: '0.2', label: 'Low' }, { value: '0.35', label: 'Medium' }, { value: '0.7', label: 'High' }],
  zigzag: [{ value: '0.2', label: 'Low' }, { value: '0.35', label: 'Medium' }, { value: '0.7', label: 'High' }],
  frame: [{ value: '0.06', label: 'Thin' }, { value: '0.15', label: 'Medium' }, { value: '0.3', label: 'Thick' }],
  ticket: [{ value: '0.15', label: 'Small' }, { value: '0.25', label: 'Medium' }, { value: '0.45', label: 'Large' }],
  rect: [{ value: '0', label: 'Square' }, { value: '0.2', label: 'Rounded' }, { value: '0.6', label: 'Soft' }],
};
const COUNT_PRESETS: Record<string, number[]> = { polygon: [3, 5, 6, 8], star: [4, 5, 6, 8], scallop: [8, 14, 20, 30], wave: [2, 3, 5, 8], zigzag: [5, 8, 12, 20] };

export interface ShapeKindValue { kind: string; sides?: number; amount?: number | null }

/**
 * A shape picker: a tile for each kind drawn from its own outline, then the kind's count (points,
 * scallops, waves…) and its one setting, as named choices first and exact numbers in Fine-tune. Used
 * for shapes and for clipping a picture or group to a shape.
 */
@Component({
  selector: 'app-shape-kind-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSegmented, UiNumberInput, UiPanelSection],
  template: `
    <div class="tiles" role="group" [attr.aria-label]="label()">
      @if (allowNone()) {
        <button type="button" class="tile none" [class.on]="!value()" (click)="changed.emit(null)" aria-label="No shape" [attr.aria-pressed]="!value()">
          <span class="name">None</span>
        </button>
      }
      @for (t of tiles(); track t.kind) {
        <button type="button" class="tile" [class.on]="value()?.kind === t.kind" (click)="pick(t.kind)"
          [attr.aria-label]="t.label" [attr.aria-pressed]="value()?.kind === t.kind" [title]="t.label">
          <span class="art" [innerHTML]="t.svg"></span>
          <span class="name">{{ t.label }}</span>
        </button>
      }
    </div>
    @if (value(); as v) {
      @if (count(v.kind); as c) {
        <ui-segmented size="sm" [label]="c.label" [options]="countOptions(v.kind)" [value]="'' + (v.sides ?? c.value)"
          (valueChange)="$event !== null && set({ sides: +$event })" />
      }
      @if (amounts(v.kind); as presets) {
        <ui-segmented size="sm" [label]="amountLabel(v.kind)" [options]="presets" [value]="named(presets, v.amount ?? amountDefault(v.kind))"
          (valueChange)="$event !== null && set({ amount: +$event })" />
      }
      @if (count(v.kind) || amounts(v.kind)) {
        <ui-panel-section title="Fine-tune (exact values)" [open]="false">
          <div class="grid2">
            @if (count(v.kind); as c) {
              <ui-number-input size="sm" [label]="c.label" [steppers]="true" [min]="c.min" [max]="c.max" [ngModel]="v.sides ?? c.value"
                (ngModelChange)="$event !== null && set({ sides: $event })" [ariaLabel]="c.label" />
            }
            @if (amounts(v.kind)) {
              <ui-number-input size="sm" [label]="amountLabel(v.kind)" [steppers]="false" [min]="0" [max]="1" [step]="0.05" [precision]="2"
                [ngModel]="v.amount ?? amountDefault(v.kind)" (ngModelChange)="$event !== null && set({ amount: $event })" [ariaLabel]="amountLabel(v.kind)" />
            }
          </div>
        </ui-panel-section>
      }
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
    .tile { display: grid; justify-items: center; gap: 3px; padding: 4px 2px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm);
      background: var(--ui-color-surface); color: var(--ui-color-text); cursor: pointer; min-width: 0; }
    .tile.on { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile.none { align-content: center; min-height: 54px; }
    .art { display: block; width: 36px; height: 28px; line-height: 0; color: var(--ui-color-text-muted); }
    .name { font-size: 10px; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  `,
})
export class ShapeKindFieldComponent {
  private readonly sanitizer = inject(DomSanitizer);
  label = input('Shape');
  kinds = input.required<readonly string[]>();
  allowNone = input(false);
  value = input<ShapeKindValue | null>(null);
  changed = output<ShapeKindValue | null>();

  protected readonly tiles = computed(() => this.kinds().map((kind) => {
    let body: string;
    if (kind === 'line') body = '<line x1="2" y1="14" x2="34" y2="14" stroke="currentColor" stroke-width="2.5"/>';
    else if (kind === 'path') body = '<path d="M4 22C8 4 18 4 20 14S30 26 32 6" fill="none" stroke="currentColor" stroke-width="2.5"/>';
    else body = `<path d="${shapeD(kind, 36, 28, SHAPE_COUNT[kind]?.value ?? 6, null, 5, 1)}" fill="currentColor" fill-rule="evenodd"/>`;
    const svg = `<svg viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">${body}</svg>`;
    return { kind, label: SHAPE_LABELS[kind] ?? kind, svg: this.sanitizer.bypassSecurityTrustHtml(svg) as SafeHtml };
  }));

  protected count(kind: string) { return SHAPE_COUNT[kind] ?? null; }
  protected countOptions(kind: string) { return (COUNT_PRESETS[kind] ?? []).map((n) => ({ value: '' + n, label: '' + n })); }
  protected amounts(kind: string) { return AMOUNT_PRESETS[kind] ?? null; }
  protected amountLabel(kind: string) { return SHAPE_AMOUNT[kind]?.label ?? 'Amount'; }
  protected amountDefault(kind: string) { return SHAPE_AMOUNT[kind]?.value ?? 0.5; }
  protected named(options: { value: string }[], v: number): string | null {
    return options.find((o) => Math.abs(+o.value - v) < 0.001)?.value ?? null;
  }

  protected pick(kind: string): void {
    // A new kind starts on its own count; its setting goes back to the default.
    this.changed.emit({ kind, sides: SHAPE_COUNT[kind]?.value ?? this.value()?.sides ?? 6, amount: null });
  }

  protected set(change: Partial<ShapeKindValue>): void {
    const v = this.value();
    if (v) this.changed.emit({ ...v, ...change });
  }
}

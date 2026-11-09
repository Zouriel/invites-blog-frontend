import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { DesignStore, type DrawStyle } from './design.store';
import { ColorRefFieldComponent } from './fields/color-ref-field.component';
import { SHAPE_LABELS } from './fields/shape-kind-field.component';
import { EXTRA_SHAPE_KINDS, SHAPE_COUNT, shapeD } from './render/shapes';

const KINDS = ['rect', 'ellipse', 'line', 'polygon', ...EXTRA_SHAPE_KINDS] as const;

const OUTLINE_WIDTHS: UiSegmentedOption[] = [
  { value: '1', label: 'Thin' }, { value: '2', label: 'Medium' }, { value: '4', label: 'Thick' },
];
const DASHES: UiSegmentedOption[] = [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }];
const TEXT_SIZES: UiSegmentedOption[] = [
  { value: '44', label: 'Heading' }, { value: '28', label: 'Subheading' }, { value: '18', label: 'Body' }, { value: '13', label: 'Small' },
];

const TOOL_NAMES: Record<string, string> = {
  text: 'Text', shape: 'Shape', slot: 'Photo slot', rsvp: 'RSVP button', link: 'Link button', dress: 'Dress colours',
};

/**
 * The desktop options bar for the tool picked on the rail, above the canvas: which shape and how it
 * looks (fill, outline colour, width and style), or a text's size and colour. Then a drag on the page
 * draws it; a click drops it at its usual size; Esc or Cancel goes back to selecting.
 */
@Component({
  selector: 'app-tool-options-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiSegmented, ColorRefFieldComponent],
  template: `
    @if (store.drawTool(); as tool) {
      <div class="bar" role="toolbar" [attr.aria-label]="name() + ' options'">
        <span class="tool">{{ name() }}</span>
        @if (tool.type === 'shape') {
          <div class="kinds" role="group" aria-label="Shape">
            @for (t of tiles; track t.kind) {
              <button type="button" class="kind" [class.on]="style().shapeKind === t.kind" [attr.aria-pressed]="style().shapeKind === t.kind"
                [attr.aria-label]="t.label" [title]="t.label" (click)="set({ shapeKind: t.kind, shapeSides: null, shapeAmount: null })">
                <span class="art" [innerHTML]="t.svg"></span>
              </button>
            }
          </div>
          @if (style().shapeKind !== 'line') {
            <app-color-ref-field class="color" label="Fill" [value]="style().fill" (changed)="set({ fill: $event })" />
          }
          <app-color-ref-field class="color" [label]="style().shapeKind === 'line' ? 'Colour' : 'Outline'" [allowNone]="style().shapeKind !== 'line'"
            [value]="style().shapeKind === 'line' ? (style().stroke ?? style().fill) : style().stroke" (changed)="set({ stroke: $event })" />
          @if (style().stroke || style().shapeKind === 'line') {
            <ui-segmented size="sm" label="Width" [options]="widths" [value]="'' + style().strokeWidth" (valueChange)="$event && set({ strokeWidth: +$event })" />
            <ui-segmented size="sm" label="Style" [options]="dashes" [value]="style().dash" (valueChange)="$event && set({ dash: $any($event) })" />
          }
        } @else if (tool.type === 'text') {
          <ui-segmented size="sm" label="Size" [options]="sizes" [value]="'' + style().textSize" (valueChange)="$event && set({ textSize: +$event })" />
          <app-color-ref-field class="color" label="Colour" [allowNone]="false" [value]="style().textColor ?? 'theme:text'" (changed)="set({ textColor: $event })" />
        }
        <span class="hint">{{ hint() }}</span>
        <ui-button size="sm" variant="ghost" (click)="store.drawTool.set(null)">Cancel</ui-button>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2) var(--ui-space-4); padding: var(--ui-space-2) var(--ui-space-3);
      border-bottom: 1px solid var(--ui-color-border); background: var(--ui-color-surface); min-width: 0; }
    .tool { font-size: var(--ui-font-size-sm); font-weight: 600; }
    .kinds { display: flex; gap: 2px; flex-wrap: wrap; }
    .kind { display: grid; place-items: center; width: 32px; height: 28px; padding: 0; border: 1px solid transparent; border-radius: var(--ui-radius-sm);
      background: transparent; color: var(--ui-color-text-secondary); cursor: pointer; }
    .kind:hover { background: var(--ui-color-surface-hover); }
    .kind.on { border-color: var(--ui-color-primary); background: var(--ui-color-selected); color: var(--ui-color-text); }
    .kind:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .art { display: block; width: 24px; height: 18px; line-height: 0; }
    .color { min-width: 0; }
    .color ::ng-deep .field { grid-template-columns: auto minmax(0, 1fr); }
    .hint { flex: 1 1 160px; min-width: 0; font-size: 12px; color: var(--ui-color-text-muted); }
  `,
})
export class ToolOptionsBarComponent {
  protected readonly store = inject(DesignStore);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly widths = OUTLINE_WIDTHS;
  protected readonly dashes = DASHES;
  protected readonly sizes = TEXT_SIZES;
  protected readonly style = this.store.drawStyle;

  protected readonly tiles = KINDS.map((kind) => {
    const body = kind === 'line'
      ? '<line x1="2" y1="16" x2="22" y2="2" stroke="currentColor" stroke-width="2"/>'
      : `<path d="${shapeD(kind, 24, 18, SHAPE_COUNT[kind]?.value ?? 6, null, 3, 1)}" fill="currentColor" fill-rule="evenodd"/>`;
    return {
      kind, label: SHAPE_LABELS[kind] ?? kind,
      svg: this.sanitizer.bypassSecurityTrustHtml(`<svg viewBox="0 0 24 18" width="24" height="18" aria-hidden="true">${body}</svg>`) as SafeHtml,
    };
  });

  protected readonly name = computed(() => {
    const tool = this.store.drawTool();
    if (!tool) return '';
    return tool.type === 'shape' ? SHAPE_LABELS[this.style().shapeKind] ?? 'Shape' : TOOL_NAMES[tool.type];
  });

  protected readonly hint = computed(() =>
    this.style().shapeKind === 'line' && this.store.drawTool()?.type === 'shape'
      ? 'Drag on the page from one end to the other · Shift keeps it straight · Esc to cancel'
      : 'Drag on the page to draw it · Shift keeps it in proportion · click for the usual size · Esc to cancel');

  protected set(change: Partial<DrawStyle>): void {
    this.store.drawStyle.update((s) => ({ ...s, ...change }));
  }
}

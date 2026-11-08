import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { DesignStore } from './design.store';
import { ICONS } from './designer-icons';
import { COMBINE_OPS, combinable, type CombineOp } from './model/combine';

const OP_ICONS: Record<CombineOp, keyof typeof ICONS> = { add: 'opAdd', cut: 'opCut', intersect: 'opIntersect', exclude: 'opExclude' };

/**
 * Combine the selected shapes into one drawn shape: Add, Cut out, Overlap or Exclude, as the shape editor
 * merges pieces. The bottom-most shape's colours and settings carry over. Says why when the selection
 * can't be combined.
 */
@Component({
  selector: 'app-combine-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent],
  template: `
    @if (problem(); as p) {
      <p class="hint">{{ p }}</p>
    } @else {
      <p class="hint">Make {{ count() }} shapes into one. It keeps the bottom one’s colours and settings.</p>
      <div class="ops" role="group" aria-label="Combine shapes">
        @for (o of ops; track o.op) {
          <button type="button" class="op" (click)="combine(o.op)" [attr.aria-label]="o.label + ': ' + o.hint">
            <hugeicons-icon [icon]="icon(o.op)" [size]="22" [strokeWidth]="1.6" aria-hidden="true" />
            <span class="name">{{ o.label }}</span>
            <span class="what">{{ o.hint }}</span>
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: 8px; }
    .hint { margin: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .ops { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .op { display: grid; justify-items: center; gap: 2px; min-height: 76px; padding: 8px 6px; border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-sm); background: var(--ui-color-surface); color: var(--ui-color-text); cursor: pointer; text-align: center; font: inherit; }
    .op:hover { border-color: var(--ui-color-primary); }
    .op:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .name { font-size: 13px; font-weight: 600; }
    .what { font-size: 11px; line-height: 1.25; color: var(--ui-color-text-muted); }
  `,
})
export class CombinePanelComponent {
  private readonly store = inject(DesignStore);
  /** The shapes were combined (the phone layout closes its panel on this). */
  readonly done = output<void>();
  protected readonly ops = COMBINE_OPS;
  protected readonly count = computed(() => this.store.selection().length);
  protected readonly problem = computed(() => {
    const scene = this.store.scene();
    if (!scene) return null;
    const check = combinable(scene, this.store.selection());
    return 'error' in check ? check.error : null;
  });

  protected icon(op: CombineOp) {
    return ICONS[OP_ICONS[op]];
  }

  protected combine(op: CombineOp): void {
    if (this.store.combine([...this.store.selection()], op)) this.done.emit();
  }
}

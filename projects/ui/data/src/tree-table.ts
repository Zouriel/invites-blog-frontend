import { Component, computed, input, signal } from '@angular/core';

export interface UiTreeTableColumn {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
}
export interface UiTreeTableRow {
  label: string;
  value: string;
  data?: Record<string, unknown>;
  children?: UiTreeTableRow[];
}

interface FlatRow { row: UiTreeTableRow; depth: number; }

/** `ui-tree-table` — hierarchical table; the first column is an expandable tree. */
@Component({
  selector: 'ui-tree-table',
  template: `
    <div class="wrap">
      <table class="tt">
        <thead>
          <tr>
            <th scope="col">{{ firstHeader() }}</th>
            @for (col of columns(); track col.key) { <th scope="col" [attr.data-align]="col.align || 'left'">{{ col.header }}</th> }
          </tr>
        </thead>
        <tbody>
          @for (f of visible(); track f.row.value) {
            <tr>
              <td [style.padding-left.px]="12 + f.depth * 18">
                @if (f.row.children?.length) {
                  <button type="button" class="chev" [class.open]="expanded().has(f.row.value)" (click)="toggle(f.row)" aria-label="Toggle">›</button>
                } @else { <span class="chev spacer"></span> }
                {{ f.row.label }}
              </td>
              @for (col of columns(); track col.key) { <td [attr.data-align]="col.align || 'left'">{{ f.row.data?.[col.key] }}</td> }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: auto; }
    .tt { width: 100%; border-collapse: collapse; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    th, td { padding: var(--ui-space-2) var(--ui-space-4); text-align: left; }
    th[data-align="right"], td[data-align="right"] { text-align: right; }
    thead th { background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    tbody tr { border-bottom: 1px solid var(--ui-color-border); }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: color-mix(in srgb, var(--ui-color-primary) 8%, transparent); }
    .chev { width: 16px; height: 16px; border: none; background: none; color: var(--ui-color-text-muted); cursor: pointer;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .chev.open { transform: rotate(90deg); }
    .chev.spacer { cursor: default; display: inline-block; }
  `,
})
export class UiTreeTable {
  rows = input<UiTreeTableRow[]>([]);
  columns = input<UiTreeTableColumn[]>([]);
  firstHeader = input('Name');
  protected readonly expanded = signal<Set<string>>(new Set());

  protected readonly visible = computed<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    const walk = (rows: UiTreeTableRow[], depth: number) => {
      for (const row of rows) {
        out.push({ row, depth });
        if (row.children?.length && this.expanded().has(row.value)) walk(row.children, depth + 1);
      }
    };
    walk(this.rows(), 0);
    return out;
  });

  protected toggle(row: UiTreeTableRow): void {
    const next = new Set(this.expanded());
    next.has(row.value) ? next.delete(row.value) : next.add(row.value);
    this.expanded.set(next);
  }
}

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { UI_CONFIG } from 'ui';

export interface UiColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Optional cell formatter; receives the raw cell value and the full row. */
  format?: (value: unknown, row: T) => string;
}

type SortDir = 'asc' | 'desc' | null;

/**
 * `ui-table` — accessible data table with click-to-sort headers and optional
 * row selection. Pass `columns` + `data`; listen to `(selectionChange)`.
 * (Virtual scroll / CDK table integration is a planned extension.)
 */
@Component({
  selector: 'ui-table',
  template: `
    <div class="wrap" [class.no-radius]="!radius()">
      <table class="ui-table">
        <thead>
          <tr>
            @if (selectable()) {
              <th class="sel" scope="col">
                <input type="checkbox" [checked]="allSelected()" [indeterminate]="someSelected()"
                       aria-label="Select all rows" (change)="toggleAll($event)" />
              </th>
            }
            @for (col of columns(); track col.key) {
              <th
                scope="col"
                [attr.data-align]="col.align || 'left'"
                [class.sortable]="col.sortable"
                [attr.aria-sort]="ariaSort(col.key)">
                @if (col.sortable) {
                  <button type="button" class="sort" (click)="sortBy(col.key)">
                    {{ col.header }}
                    <span class="arrow" aria-hidden="true">{{ sortGlyph(col.key) }}</span>
                  </button>
                } @else {
                  {{ col.header }}
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of sorted(); track $index) {
            <tr [class.selected]="selected().has(row)">
              @if (selectable()) {
                <td class="sel">
                  <input type="checkbox" [checked]="selected().has(row)"
                         [attr.aria-label]="'Select row ' + ($index + 1)" (change)="toggleRow(row)" />
                </td>
              }
              @for (col of columns(); track col.key) {
                <td [attr.data-align]="col.align || 'left'">{{ cell(row, col) }}</td>
              }
            </tr>
          } @empty {
            <tr><td class="empty" [attr.colspan]="colspan()">{{ emptyText() }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: auto; }
    .wrap.no-radius { border-radius: 0; }
    .ui-table { width: 100%; border-collapse: collapse; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    th, td { padding: var(--ui-space-2) var(--ui-space-4); text-align: left; }
    th[data-align="right"], td[data-align="right"] { text-align: right; }
    th[data-align="center"], td[data-align="center"] { text-align: center; }
    thead th { background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); white-space: nowrap; }
    tbody tr { border-bottom: 1px solid var(--ui-color-border); transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: color-mix(in srgb, var(--ui-color-primary) 8%, transparent); }
    tbody tr.selected { background: color-mix(in srgb, var(--ui-color-primary) 16%, transparent); }
    .sort { display: inline-flex; align-items: center; gap: var(--ui-space-1); background: none; border: none; color: inherit; font: inherit; cursor: pointer; padding: 0; }
    .sort:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 4px; }
    .arrow { width: 1em; display: inline-block; }
    .sel { width: 1px; white-space: nowrap; }
    .empty { text-align: center; color: var(--ui-color-text-muted); padding: var(--ui-space-6); }
  `,
})
export class UiTable<T extends Record<string, unknown> = Record<string, unknown>> {
  private config = inject(UI_CONFIG);
  columns = input<UiColumn<T>[]>([]);
  data = input<T[]>([]);
  selectable = input(false);
  emptyText = input('No data');
  radius = input<boolean>(this.config.radius);
  selectionChange = output<T[]>();

  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<SortDir>(null);
  protected readonly selected = signal<Set<T>>(new Set());

  protected readonly sorted = computed(() => {
    const rows = this.data();
    const key = this.sortKey();
    const dir = this.sortDir();
    if (!key || !dir) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  });

  protected readonly colspan = computed(() => this.columns().length + (this.selectable() ? 1 : 0));
  protected readonly allSelected = computed(() => this.data().length > 0 && this.selected().size === this.data().length);
  protected readonly someSelected = computed(() => this.selected().size > 0 && !this.allSelected());

  protected cell(row: T, col: UiColumn<T>): string {
    const value = row[col.key];
    if (col.format) return col.format(value, row);
    return value == null ? '' : String(value);
  }

  protected sortBy(key: string): void {
    if (this.sortKey() !== key) {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    } else {
      const next: SortDir = this.sortDir() === 'asc' ? 'desc' : this.sortDir() === 'desc' ? null : 'asc';
      this.sortDir.set(next);
      if (!next) this.sortKey.set(null);
    }
  }

  protected ariaSort(key: string): string | null {
    if (this.sortKey() !== key || !this.sortDir()) return null;
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }
  protected sortGlyph(key: string): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '↑' : this.sortDir() === 'desc' ? '↓' : '↕';
  }

  protected toggleRow(row: T): void {
    const next = new Set(this.selected());
    next.has(row) ? next.delete(row) : next.add(row);
    this.selected.set(next);
    this.selectionChange.emit([...next]);
  }
  protected toggleAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const next = checked ? new Set(this.data()) : new Set<T>();
    this.selected.set(next);
    this.selectionChange.emit([...next]);
  }
}

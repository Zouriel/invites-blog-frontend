import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import {
  UiPathEditor, archContour, breakAt, deletePoint, ellipseContour, joinEnds, polygonContour, rectContour, starContour,
  toggleClosed, toggleSmooth, translateContours, type UiPathContour, type UiPathItem, type UiPointRef,
} from '@zouriel/ui/canvas';
import { UiModal } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import { findElement, resolveColor } from './model/scene-ops';
import { itemsToPath, mergeItems, shapeToContours } from './model/shape-paths';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ICONS, type DesignerIcon } from './designer-icons';

interface Tool {
  id: string;
  label: string;
  icon: DesignerIcon;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
  on?: boolean;
}

let pieceSeq = 0;
const newId = () => `piece${Date.now().toString(36)}${pieceSeq++}`;

/**
 * The shape editor: a window over the designer for drawing one shape out of pieces.
 *
 * <p>It works on a copy. Pieces are added (box, circle, triangle, polygon, star, arch), stacked, moved,
 * scaled and turned; a piece marked "cut out" removes its area from the pieces before it once merged.
 * In Points, the selected piece's points and curve handles are edited directly: drag them, tap an edge
 * to add one, break the outline at a point, join two loose ends, make a corner smooth or a curve sharp.
 * Save turns everything into one drawn shape on the page; Cancel leaves the page as it was.</p>
 */
@Component({
  selector: 'app-shape-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, UiButton, UiIconButton, UiPathEditor, UiSegmented, HugeiconsIconComponent],
  template: `
    <ui-modal [open]="open()" (openChange)="!$event && cancel()" size="full" [closeOnBackdrop]="false">
      <div class="shell">
        <header class="bar">
          <ui-button size="sm" variant="ghost" (click)="cancel()">Cancel</ui-button>
          <div class="title">
            <strong>Edit shape</strong>
            <span class="hint">{{ hint() }}</span>
          </div>
          <ui-icon-button size="sm" label="Undo" [disabled]="!past().length" (click)="undo()"><hugeicons-icon [icon]="icons.undo" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
          <ui-icon-button size="sm" label="Redo" [disabled]="!future().length" (click)="redo()"><hugeicons-icon [icon]="icons.redo" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
          <ui-button size="sm" variant="primary" [disabled]="!items().length" (click)="save()">Save</ui-button>
        </header>

        <div class="work">
          <ui-path-editor #editor class="surface" label="Shape drawing" [items]="items()" [width]="box().w" [height]="box().h"
            [mode]="mode()" [(selectedId)]="selectedId" [(selectedPoint)]="selectedPoint"
            (itemsChange)="commit($event)" (pointTap)="onPointTap($event)" />
          <div class="zoom">
            <ui-icon-button size="sm" label="Zoom in" (click)="editor.zoomBy(1.4)">＋</ui-icon-button>
            <ui-icon-button size="sm" label="Zoom out" (click)="editor.zoomBy(1 / 1.4)">－</ui-icon-button>
            <ui-icon-button size="sm" label="Fit" (click)="editor.fit()">⤢</ui-icon-button>
          </div>
        </div>

        <footer class="dockbar">
          <div class="modes">
            <ui-segmented size="sm" label="Edit" [options]="modeOptions" [value]="mode()" (valueChange)="setMode($event)" />
          </div>
          <nav class="dock" aria-label="Shape tools">
            @for (t of tools(); track t.id) {
              <button type="button" class="dock-tool" [class.danger]="t.danger" [class.on]="t.on" [disabled]="t.disabled"
                [attr.aria-pressed]="t.on ?? null" (mousedown)="$event.preventDefault()" (click)="t.run()">
                <span class="glyph" aria-hidden="true"><hugeicons-icon [icon]="t.icon" [size]="22" [strokeWidth]="1.7" /></span>
                <span class="label">{{ t.label }}</span>
              </button>
            }
          </nav>
        </footer>
      </div>
    </ui-modal>
  `,
  styles: `
    .shell { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr); width: 100%; height: 100%;
      min-height: 0; min-width: 0; overflow: hidden; background: var(--ui-color-surface); }
    .bar { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 8px 10px; padding-top: calc(8px + env(safe-area-inset-top, 0px));
      border-bottom: 1px solid var(--ui-color-border); }
    .title { flex: 1; min-width: 0; display: grid; text-align: center; line-height: 1.25; }
    .title strong { font-size: 15px; }
    .hint { font-size: 12px; color: var(--ui-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .work { position: relative; min-height: 0; }
    .surface { position: absolute; inset: 0; }
    .zoom { position: absolute; right: 10px; top: 10px; display: grid; gap: 4px; padding: 4px; border-radius: var(--ui-radius);
      background: var(--ui-color-surface); box-shadow: var(--ui-shadow-2); }
    .dockbar { min-width: 0; border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      padding-bottom: env(safe-area-inset-bottom, 0px); }
    .modes { display: flex; justify-content: center; padding: 8px 10px 2px; }
    .dock { display: flex; gap: 2px; padding: 4px 6px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
    .dock::-webkit-scrollbar { display: none; }
    .dock-tool { flex: none; display: grid; justify-items: center; align-content: center; gap: 2px; min-width: 58px; height: 56px;
      padding: 0 6px; border: 0; border-radius: var(--ui-radius); background: transparent; color: var(--ui-color-text); font: inherit; cursor: pointer; }
    .dock-tool:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .dock-tool.on { background: var(--ui-color-selected); }
    .dock-tool.danger { color: var(--ui-color-danger); }
    .dock-tool:disabled { opacity: .38; cursor: default; }
    .glyph { display: grid; place-items: center; height: 24px; line-height: 1; }
    .label { font-size: 11.5px; white-space: nowrap; }
    @media (min-width: 900px) { .dock { justify-content: center; } }
  `,
})
export class ShapeEditorComponent {
  protected readonly icons = ICONS;
  protected readonly store = inject(DesignStore);
  protected readonly element = computed(() => {
    const id = this.store.shapeEditorId();
    const scene = this.store.scene();
    return id && scene ? findElement(scene, id) : null;
  });
  protected readonly open = computed(() => !!this.element());
  /** The artboard: the shape's own box, frozen when the editor opened. */
  protected readonly box = signal({ w: 100, h: 100 });

  protected readonly items = signal<UiPathItem[]>([]);
  protected readonly past = signal<UiPathItem[][]>([]);
  protected readonly future = signal<UiPathItem[][]>([]);
  protected readonly mode = signal<'objects' | 'points'>('objects');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedPoint = signal<UiPointRef | null>(null);
  /** A loose end tapped earlier, waiting for a second one to join to. */
  private readonly pendingEnd = signal<UiPointRef | null>(null);

  protected readonly modeOptions = [{ value: 'objects', label: 'Shapes' }, { value: 'points', label: 'Points' }];

  private readonly selectedItem = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
  private readonly fill = computed(() => {
    const scene = this.store.scene();
    const el = this.element();
    return scene && el?.shape?.fill ? resolveColor(scene, el.shape.fill, '#8a94a6') : '#8a94a6';
  });

  protected readonly hint = computed(() => {
    if (this.mode() === 'objects') {
      return this.selectedItem() ? 'Drag to move · corners to size · top knob to turn' : 'Add pieces below, or tap one to select it';
    }
    if (!this.selectedItem()) return 'Tap a piece to edit its points';
    if (this.pendingEnd()) return 'Now tap the other loose end to join them';
    return this.selectedPoint() ? 'Drag the point or its handles' : 'Tap a point · tap an edge to add one';
  });

  protected readonly tools = computed<Tool[]>(() => {
    const item = this.selectedItem();
    if (this.mode() === 'objects') {
      const index = item ? this.items().indexOf(item) : -1;
      const add: Tool[] = [
        { id: 'box', label: 'Box', icon: ICONS.box, run: () => this.add('box') },
        { id: 'circle', label: 'Circle', icon: ICONS.circle, run: () => this.add('circle') },
        { id: 'triangle', label: 'Triangle', icon: ICONS.triangle, run: () => this.add('triangle') },
        { id: 'arch', label: 'Arch', icon: ICONS.arch, run: () => this.add('arch') },
        { id: 'star', label: 'Star', icon: ICONS.star, run: () => this.add('star') },
        { id: 'hexagon', label: 'Polygon', icon: ICONS.polygon, run: () => this.add('hexagon') },
      ];
      const selected: Tool[] = item ? [
        { id: 'cut', label: item.cut ? 'Cutting out' : 'Cut out', icon: ICONS.cut, on: !!item.cut, run: () => this.toggleCut() },
        { id: 'dup', label: 'Duplicate', icon: ICONS.duplicate, run: () => this.duplicate() },
        { id: 'up', label: 'Forward', icon: ICONS.front, disabled: index >= this.items().length - 1, run: () => this.restack(1) },
        { id: 'down', label: 'Back', icon: ICONS.back, disabled: index <= 0, run: () => this.restack(-1) },
        { id: 'delete', label: 'Delete', icon: ICONS.delete, danger: true, run: () => this.removeItem() },
      ] : [];
      const merge: Tool = {
        id: 'merge', label: 'Merge', icon: ICONS.merge, run: () => this.merge(),
        disabled: this.items().length < 2 && !this.items().some((i) => i.cut),
      };
      return [...add, ...(item ? [merge, ...selected] : [merge])];
    }

    const ref = this.selectedPoint();
    const contour = item && ref ? item.contours[ref.contour] : null;
    const point = contour && ref ? contour.points[ref.point] : null;
    const isEnd = !!contour && !contour.closed && !!ref && (ref.point === 0 || ref.point === contour.points.length - 1);
    return [
      { id: 'smooth', label: point?.in || point?.out ? 'Sharp' : 'Curve', icon: point?.in || point?.out ? ICONS.sharp : ICONS.curve, disabled: !point, run: () => this.pointAction('smooth') },
      { id: 'break', label: 'Break', icon: ICONS.breakPath, disabled: !point || isEnd, run: () => this.pointAction('break') },
      { id: 'join', label: 'Join ends', icon: ICONS.join, on: !!this.pendingEnd(), disabled: !isEnd, run: () => this.startJoin() },
      { id: 'close', label: contour?.closed ? 'Open' : 'Close', icon: contour?.closed ? ICONS.open : ICONS.close, disabled: !contour, run: () => this.pointAction('close') },
      { id: 'delpoint', label: 'Delete point', icon: ICONS.deletePoint, danger: true, disabled: !point, run: () => this.pointAction('delete') },
    ];
  });

  constructor() {
    // A fresh copy each time the editor opens.
    effect(() => {
      const el = this.element();
      untracked(() => {
        if (!el) return;
        this.box.set({ w: Math.max(1, el.w), h: Math.max(1, el.h) });
        this.items.set([{ id: newId(), contours: shapeToContours(el), fill: this.fill() }]);
        this.past.set([]);
        this.future.set([]);
        this.mode.set(el.shape?.kind === 'path' ? 'points' : 'objects');
        this.selectedId.set(this.items()[0].id);
        this.selectedPoint.set(null);
        this.pendingEnd.set(null);
      });
    });
  }

  protected commit(next: UiPathItem[]): void {
    this.past.update((p) => [...p.slice(-99), this.items()]);
    this.future.set([]);
    this.items.set(next);
  }

  protected undo(): void {
    const prev = this.past().at(-1);
    if (!prev) return;
    this.past.update((p) => p.slice(0, -1));
    this.future.update((f) => [this.items(), ...f]);
    this.items.set(prev);
    this.selectedPoint.set(null);
  }

  protected redo(): void {
    const next = this.future()[0];
    if (!next) return;
    this.future.update((f) => f.slice(1));
    this.past.update((p) => [...p, this.items()]);
    this.items.set(next);
    this.selectedPoint.set(null);
  }

  protected setMode(value: string | null): void {
    this.mode.set(value === 'points' ? 'points' : 'objects');
    this.selectedPoint.set(null);
    this.pendingEnd.set(null);
    if (!this.selectedId() && this.items().length) this.selectedId.set(this.items().at(-1)!.id);
  }

  private add(kind: 'box' | 'circle' | 'triangle' | 'arch' | 'star' | 'hexagon'): void {
    const { w, h } = this.box();
    const size = Math.max(12, Math.min(w, h) * 0.5);
    const x = w / 2 - size / 2;
    const y = h / 2 - size / 2;
    const contour: UiPathContour = {
      box: rectContour(x, y, size, size),
      circle: ellipseContour(w / 2, h / 2, size / 2, size / 2),
      triangle: polygonContour(x, y, size, size, 3),
      arch: archContour(x, y, size * 0.7, size),
      star: starContour(x, y, size, size),
      hexagon: polygonContour(x, y, size, size, 6),
    }[kind];
    const item: UiPathItem = { id: newId(), contours: [contour], fill: this.fill() };
    this.commit([...this.items(), item]);
    this.mode.set('objects');
    this.selectedId.set(item.id);
    this.selectedPoint.set(null);
  }

  private updateSelected(fn: (item: UiPathItem) => UiPathItem): void {
    const item = this.selectedItem();
    if (!item) return;
    this.commit(this.items().map((i) => (i.id === item.id ? fn(i) : i)));
  }

  private toggleCut(): void {
    this.updateSelected((i) => ({ ...i, cut: !i.cut }));
  }

  private duplicate(): void {
    const item = this.selectedItem();
    if (!item) return;
    const copy: UiPathItem = { ...item, id: newId(), contours: translateContours(item.contours, 12, 12) };
    const list = [...this.items()];
    list.splice(list.indexOf(item) + 1, 0, copy);
    this.commit(list);
    this.selectedId.set(copy.id);
  }

  private restack(by: 1 | -1): void {
    const item = this.selectedItem();
    if (!item) return;
    const list = [...this.items()];
    const from = list.indexOf(item);
    const to = Math.max(0, Math.min(list.length - 1, from + by));
    list.splice(from, 1);
    list.splice(to, 0, item);
    this.commit(list);
  }

  private removeItem(): void {
    const item = this.selectedItem();
    if (!item) return;
    this.commit(this.items().filter((i) => i.id !== item.id));
    this.selectedId.set(null);
  }

  /** Everything into one outline: pieces add, cut-outs remove, in stacking order. */
  private merge(): void {
    const contours = mergeItems(this.items());
    if (!contours.length) return;
    const item: UiPathItem = { id: newId(), contours, fill: this.fill() };
    this.commit([item]);
    this.selectedId.set(item.id);
    this.selectedPoint.set(null);
  }

  private pointAction(action: 'smooth' | 'break' | 'close' | 'delete'): void {
    const item = this.selectedItem();
    const ref = this.selectedPoint();
    if (!item || !ref) return;
    let contours: UiPathContour[];
    switch (action) {
      case 'smooth': contours = toggleSmooth(item.contours, ref); break;
      case 'break': contours = breakAt(item.contours, ref); break;
      case 'close': contours = toggleClosed(item.contours, ref.contour); break;
      default: contours = deletePoint(item.contours, ref);
    }
    this.updateSelected((i) => ({ ...i, contours }));
    if (action !== 'smooth') this.selectedPoint.set(null);
  }

  private startJoin(): void {
    const ref = this.selectedPoint();
    this.pendingEnd.set(this.pendingEnd() ? null : ref);
  }

  protected onPointTap(ref: UiPointRef): void {
    const first = this.pendingEnd();
    const item = this.selectedItem();
    if (!first || !item) return;
    if (first.contour === ref.contour && first.point === ref.point) return;
    this.pendingEnd.set(null);
    const contours = joinEnds(item.contours, first, ref);
    this.updateSelected((i) => ({ ...i, contours }));
    this.selectedPoint.set(null);
  }

  protected save(): void {
    const el = this.element();
    if (!el) return;
    const result = itemsToPath(this.items());
    if (result) this.store.applyDrawnShape(el.id, result.path, result.box);
    this.store.shapeEditorId.set(null);
  }

  protected cancel(): void {
    this.store.shapeEditorId.set(null);
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import {
  UiPathEditor, archContour, breakAt, deletePoints, ellipseContour, itemOp, joinEnds, polygonContour, rectContour, starContour,
  toggleClosed, toggleSmooth, translateContours, type UiBrushKind, type UiInkStroke, type UiPathContour, type UiPathEditorMode,
  type UiPathItem, type UiPathOp, type UiPointRef,
} from '@zouriel/ui/canvas';
import { UiModal } from '@zouriel/ui/dialog';
import { UiSlider } from '@zouriel/ui/form';
import { DesignStore } from './design.store';
import { findElement, resolveColor } from './model/scene-ops';
import { eraseItems, inkToContours, itemsToPath, mergeItems, shapeToContours } from './model/shape-paths';
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
  /** Starts a new group in the dock (a thin divider before it). */
  gap?: boolean;
}

let pieceSeq = 0;
const newId = () => `piece${Date.now().toString(36)}${pieceSeq++}`;

const BRUSHES: { kind: UiBrushKind; label: string; icon: DesignerIcon }[] = [
  { kind: 'pen', label: 'Pen', icon: ICONS.inkPen },
  { kind: 'marker', label: 'Marker', icon: ICONS.marker },
  { kind: 'pencil', label: 'Pencil', icon: ICONS.pencil },
  { kind: 'brush', label: 'Brush', icon: ICONS.brush },
  { kind: 'calligraphy', label: 'Calligraphy', icon: ICONS.calligraphy },
];

const OPS: { op: UiPathOp; label: string; icon: DesignerIcon }[] = [
  { op: 'add', label: 'Add', icon: ICONS.opAdd },
  { op: 'cut', label: 'Cut out', icon: ICONS.opCut },
  { op: 'intersect', label: 'Overlap', icon: ICONS.opIntersect },
  { op: 'exclude', label: 'Exclude', icon: ICONS.opExclude },
];

/**
 * The shape editor: a window over the designer for drawing one shape out of pieces.
 *
 * <p>It works on a copy, in four modes:</p>
 * <ul>
 *   <li><b>Shapes</b> — add pieces (box, circle, triangle, arch, star, polygon), move, size and turn them,
 *   and set how each combines with the pieces under it: add, cut out, overlap or exclude.</li>
 *   <li><b>Draw</b> — paint with a pen, marker, pencil, brush or calligraphy nib; an S Pen's pressure is
 *   used, and once a pen has touched the screen fingers move the view instead of drawing. Hold at the
 *   end of a stroke to snap it to a line, circle, rectangle or triangle. The eraser rubs out what it
 *   goes over, or whole pieces. Every stroke becomes a piece shaped exactly like the ink.</li>
 *   <li><b>Pen</b> — Photoshop's pen: tap for corners, drag for curves, tap the first point to close.</li>
 *   <li><b>Points</b> — edit the selected piece's points and curve handles; select several (Shift-click,
 *   long press, or drag a box with a mouse or pen) and move or delete them together.</li>
 * </ul>
 * <p>Save turns everything into one drawn shape on the page; Cancel leaves the page as it was.</p>
 */
@Component({
  selector: 'app-shape-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiModal, UiButton, UiIconButton, UiPathEditor, UiSegmented, UiSlider, FormsModule, HugeiconsIconComponent],
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
          <ui-button size="sm" variant="primary" [disabled]="!items().length && !editor.penCount()" (click)="save()">Save</ui-button>
        </header>

        <div class="work">
          <ui-path-editor #editor class="surface" label="Shape drawing" [items]="items()" [width]="box().w" [height]="box().h"
            [mode]="mode()" [brush]="brush()" [fill]="fill()" [fingerDraws]="fingerDraws()" [snapToShape]="snap()" [freeHandles]="splitHandles()"
            [(selectedId)]="selectedId" [(selectedPoint)]="selectedPoint" [(selectedPoints)]="selectedPoints"
            (itemsChange)="commit($event)" (pointTap)="onPointTap($event)" (stroke)="onStroke($event)" (penDetected)="penSeen.set(true)" />
          <div class="zoom">
            <ui-icon-button size="sm" label="Zoom in" (click)="editor.zoomBy(1.4)"><hugeicons-icon [icon]="icons.zoomIn" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button size="sm" label="Zoom out" (click)="editor.zoomBy(1 / 1.4)"><hugeicons-icon [icon]="icons.zoomOut" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button size="sm" label="Fit" (click)="editor.fit()"><hugeicons-icon [icon]="icons.fit" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
          </div>
        </div>

        <footer class="dockbar">
          <div class="modes">
            <ui-segmented size="sm" label="Edit" [options]="modeOptions" [value]="mode()" (valueChange)="setMode($event)" />
          </div>
          @if (mode() === 'draw') {
            <div class="size">
              <span class="nib" aria-hidden="true"><span class="dot" [style.width.px]="nibPx()" [style.height.px]="nibPx()"
                [class.erase]="brushKind() === 'eraser'"></span></span>
              <ui-slider class="size-slider" label="Brush size" [min]="1" [max]="60" [step]="1"
                [ngModel]="sizes()[brushKind()]" (ngModelChange)="setSize($event)" />
            </div>
          }
          <nav class="dock" aria-label="Shape tools">
            @for (t of tools(); track t.id) {
              <button type="button" class="dock-tool" [class.danger]="t.danger" [class.on]="t.on" [class.gap]="t.gap" [disabled]="t.disabled"
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
    /* Chrome, not text: a stylus (Samsung's S Pen writes into anything that looks like it takes text) and a
       long press should never treat the bars as something to write in or select. */
    .bar, .dockbar { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .bar { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 8px 10px; padding-top: calc(8px + env(safe-area-inset-top, 0px));
      border-bottom: 1px solid var(--ui-color-border); touch-action: manipulation; }
    .title { flex: 1; min-width: 0; display: grid; text-align: center; line-height: 1.25; }
    .title strong { font-size: 15px; }
    .hint { font-size: 12px; color: var(--ui-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .work { position: relative; min-height: 0; }
    .surface { position: absolute; inset: 0; }
    .zoom { position: absolute; right: 10px; top: 10px; display: grid; gap: 4px; padding: 4px; border-radius: var(--ui-radius);
      background: var(--ui-color-surface); box-shadow: var(--ui-shadow-2); }
    .dockbar { min-width: 0; border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      padding-bottom: env(safe-area-inset-bottom, 0px); }
    .modes { display: flex; justify-content: center; padding: 8px 10px 2px; touch-action: manipulation; }
    .size { display: flex; align-items: center; gap: 10px; max-width: 460px; margin: 0 auto; padding: 6px 16px 0; }
    .nib { flex: none; display: grid; place-items: center; width: 28px; height: 28px; }
    .dot { display: block; min-width: 2px; min-height: 2px; max-width: 28px; max-height: 28px; border-radius: 50%; background: var(--ui-color-text); }
    .dot.erase { background: transparent; border: 1.5px dashed var(--ui-color-danger); }
    .size-slider { flex: 1; min-width: 0; }
    .dock { display: flex; gap: 2px; padding: 4px 6px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; touch-action: pan-x; }
    .dock::-webkit-scrollbar { display: none; }
    .dock-tool { flex: none; display: grid; justify-items: center; align-content: center; gap: 2px; min-width: 58px; height: 56px;
      padding: 0 6px; border: 0; border-radius: var(--ui-radius); background: transparent; color: var(--ui-color-text); font: inherit; cursor: pointer;
      touch-action: pan-x; }
    .dock-tool.gap { margin-left: 9px; position: relative; }
    .dock-tool.gap::before { content: ''; position: absolute; left: -6px; top: 12px; bottom: 12px; width: 1px; background: var(--ui-color-border); }
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
  private readonly pathEditor = viewChild<UiPathEditor>('editor');
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
  protected readonly mode = signal<UiPathEditorMode>('objects');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedPoint = signal<UiPointRef | null>(null);
  protected readonly selectedPoints = signal<UiPointRef[]>([]);
  /** A loose end tapped earlier, waiting for a second one to join to. */
  private readonly pendingEnd = signal<UiPointRef | null>(null);

  // Drawing.
  protected readonly brushKind = signal<UiBrushKind>('pen');
  /** Each brush keeps its own size (in the shape's units, which are the page's pixels). */
  protected readonly sizes = signal<Record<UiBrushKind, number>>({ pen: 3, marker: 12, pencil: 2, brush: 8, calligraphy: 10, eraser: 16 });
  protected readonly brush = computed(() => ({ kind: this.brushKind(), size: this.sizes()[this.brushKind()] }));
  protected readonly eraseWhole = signal(false);
  protected readonly snap = signal(true);
  protected readonly penSeen = signal(false);
  /** 'auto' until someone flips it: fingers draw until a pen is used. */
  protected readonly fingerDraws = signal<boolean | 'auto'>('auto');
  private readonly fingersDraw = computed(() => (this.fingerDraws() === 'auto' ? !this.penSeen() : this.fingerDraws() === true));
  protected readonly splitHandles = signal(false);
  /** The size preview's dot, in screen pixels (roughly: the artboard fills most of the view). */
  protected readonly nibPx = computed(() => Math.max(2, Math.min(28, this.brush().size)));

  protected readonly modeOptions = [
    { value: 'objects', label: 'Shapes' }, { value: 'draw', label: 'Draw' }, { value: 'pen', label: 'Pen' }, { value: 'points', label: 'Points' },
  ];

  private readonly selectedItem = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
  private readonly penCount = computed(() => this.pathEditor()?.penCount() ?? 0);
  protected readonly fill = computed(() => {
    const scene = this.store.scene();
    const el = this.element();
    return scene && el?.shape?.fill ? resolveColor(scene, el.shape.fill, '#8a94a6') : '#8a94a6';
  });

  protected readonly hint = computed(() => {
    switch (this.mode()) {
      case 'draw':
        if (this.brushKind() === 'eraser') return this.eraseWhole() ? 'Touch a piece to remove it' : 'Rub over what to erase';
        return this.fingersDraw() ? 'Draw · hold still at the end to snap to a shape' : 'Draw with the pen · fingers move the view';
      case 'pen':
        return this.penCount() ? 'Tap the first point to close · Done to finish' : 'Tap for corners · drag for curves';
      case 'objects':
        return this.selectedItem() ? 'Drag to move · corners to size · top knob to turn' : 'Add pieces below, or tap one to select it';
    }
    if (!this.selectedItem()) return 'Tap a piece to edit its points';
    if (this.pendingEnd()) return 'Now tap the other loose end to join them';
    const n = this.selectedPoints().length;
    if (n > 1) return `${n} points selected · drag one to move them all`;
    return this.selectedPoint() ? 'Drag it · double-tap for curve or corner · long-press to add more' : 'Tap a point · tap an edge to add one';
  });

  protected readonly tools = computed<Tool[]>(() => {
    switch (this.mode()) {
      case 'draw': return this.drawTools();
      case 'pen': return this.penTools();
      case 'points': return this.pointTools();
      default: return this.shapeTools();
    }
  });

  private shapeTools(): Tool[] {
    const item = this.selectedItem();
    const index = item ? this.items().indexOf(item) : -1;
    const add: Tool[] = [
      { id: 'box', label: 'Box', icon: ICONS.box, run: () => this.add('box') },
      { id: 'circle', label: 'Circle', icon: ICONS.circle, run: () => this.add('circle') },
      { id: 'triangle', label: 'Triangle', icon: ICONS.triangle, run: () => this.add('triangle') },
      { id: 'arch', label: 'Arch', icon: ICONS.arch, run: () => this.add('arch') },
      { id: 'star', label: 'Star', icon: ICONS.star, run: () => this.add('star') },
      { id: 'hexagon', label: 'Polygon', icon: ICONS.polygon, run: () => this.add('hexagon') },
    ];
    const merge: Tool = {
      id: 'merge', label: 'Merge', icon: ICONS.merge, gap: true, run: () => this.merge(),
      disabled: this.items().length < 2 && !this.items().some((i) => itemOp(i) !== 'add'),
    };
    if (!item) return [...add, merge];
    const op = itemOp(item);
    const ops: Tool[] = OPS.map((o, i) => ({ id: `op-${o.op}`, label: o.label, icon: o.icon, on: op === o.op, gap: i === 0, run: () => this.setOp(o.op) }));
    return [
      ...add, merge, ...ops,
      { id: 'dup', label: 'Duplicate', icon: ICONS.duplicate, gap: true, run: () => this.duplicate() },
      { id: 'up', label: 'Forward', icon: ICONS.front, disabled: index >= this.items().length - 1, run: () => this.restack(1) },
      { id: 'down', label: 'Back', icon: ICONS.back, disabled: index <= 0, run: () => this.restack(-1) },
      { id: 'delete', label: 'Delete', icon: ICONS.delete, danger: true, run: () => this.removeItem() },
    ];
  }

  private drawTools(): Tool[] {
    const kind = this.brushKind();
    const brushes: Tool[] = BRUSHES.map((b) => ({ id: `brush-${b.kind}`, label: b.label, icon: b.icon, on: kind === b.kind, run: () => this.brushKind.set(b.kind) }));
    const eraser: Tool = { id: 'eraser', label: 'Eraser', icon: ICONS.eraser, on: kind === 'eraser', gap: true, run: () => this.brushKind.set('eraser') };
    const whole: Tool[] = kind === 'eraser'
      ? [{ id: 'erase-whole', label: 'Whole pieces', icon: ICONS.eraseWhole, on: this.eraseWhole(), run: () => this.eraseWhole.update((v) => !v) }]
      : [];
    return [
      ...brushes, eraser, ...whole,
      { id: 'snap', label: 'Snap shapes', icon: ICONS.snapShape, on: this.snap(), gap: true, run: () => this.snap.update((v) => !v) },
      { id: 'finger', label: 'Finger draws', icon: ICONS.fingerDraws, on: this.fingersDraw(), run: () => this.fingerDraws.set(!this.fingersDraw()) },
      { id: 'clear', label: 'Clear', icon: ICONS.delete, danger: true, gap: true, disabled: !this.items().length, run: () => this.clearAll() },
    ];
  }

  private penTools(): Tool[] {
    const n = this.penCount();
    const ed = () => this.pathEditor();
    return [
      { id: 'pen-done', label: 'Done', icon: ICONS.done, disabled: n < 2, run: () => ed()?.finishPen(false) },
      { id: 'pen-close', label: 'Close shape', icon: ICONS.close, disabled: n < 3, run: () => ed()?.finishPen(true) },
      { id: 'pen-undo', label: 'Undo point', icon: ICONS.deletePoint, disabled: !n, run: () => ed()?.undoPenPoint() },
      { id: 'pen-cancel', label: 'Discard', icon: ICONS.remove, danger: true, disabled: !n, run: () => ed()?.cancelPen() },
    ];
  }

  private pointTools(): Tool[] {
    const item = this.selectedItem();
    const ref = this.selectedPoint();
    const refs = this.selectedPoints();
    const contour = item && ref ? item.contours[ref.contour] : null;
    const points = item ? refs.map((r) => item.contours[r.contour]?.points[r.point]).filter((p) => !!p) : [];
    const anyCorner = points.some((p) => !p.in && !p.out);
    const isEnd = !!contour && !contour.closed && !!ref && (ref.point === 0 || ref.point === contour.points.length - 1);
    return [
      { id: 'select-all', label: 'Select all', icon: ICONS.selectAll, disabled: !item, run: () => this.pathEditor()?.selectAllPoints() },
      { id: 'smooth', label: points.length && !anyCorner ? 'Sharp' : 'Curve', icon: points.length && !anyCorner ? ICONS.sharp : ICONS.curve, disabled: !points.length, run: () => this.smoothSelected() },
      { id: 'split', label: 'Split handles', icon: ICONS.splitHandles, on: this.splitHandles(), run: () => this.splitHandles.update((v) => !v) },
      { id: 'break', label: 'Break', icon: ICONS.breakPath, gap: true, disabled: !ref || isEnd || refs.length > 1, run: () => this.pointAction('break') },
      { id: 'join', label: 'Join ends', icon: ICONS.join, on: !!this.pendingEnd(), disabled: !isEnd, run: () => this.startJoin() },
      { id: 'close', label: contour?.closed ? 'Open' : 'Close', icon: contour?.closed ? ICONS.open : ICONS.close, disabled: !contour, run: () => this.pointAction('close') },
      { id: 'delpoint', label: refs.length > 1 ? `Delete ${refs.length}` : 'Delete point', icon: ICONS.deletePoint, danger: true, gap: true, disabled: !points.length, run: () => this.deleteSelectedPoints() },
    ];
  }

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
    const mode = (['objects', 'points', 'draw', 'pen'] as const).find((m) => m === value) ?? 'objects';
    // Ink is the shape's own colour, so drawing over the plain box it started as would show nothing and
    // add nothing: the first time Draw is picked on a shape nobody has touched yet, start from a blank
    // page (Undo brings the box back).
    if (mode === 'draw' && this.untouched() && this.element()?.shape?.kind !== 'path') this.clearAll();
    this.mode.set(mode);
    this.selectedPoint.set(null);
    this.pendingEnd.set(null);
    if (mode === 'points' && !this.selectedId() && this.items().length) this.selectedId.set(this.items().at(-1)!.id);
  }

  /** Nothing has been done since the editor opened. */
  private untouched(): boolean {
    return !this.past().length && !this.future().length && this.items().length === 1;
  }

  private clearAll(): void {
    if (!this.items().length) return;
    this.commit([]);
    this.selectedId.set(null);
    this.selectedPoint.set(null);
  }

  protected setSize(value: number): void {
    const kind = this.brushKind();
    this.sizes.update((s) => ({ ...s, [kind]: Math.max(1, Math.min(60, Math.round(value))) }));
  }

  // ----- Shapes --------------------------------------------------------------------------------------

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

  private setOp(op: UiPathOp): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.updateSelected(({ cut, ...rest }) => ({ ...rest, op }));
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

  /** Everything into one outline, each piece combining with those below it as its operation says. */
  private merge(): void {
    const contours = mergeItems(this.items());
    if (!contours.length) return;
    const item: UiPathItem = { id: newId(), contours, fill: this.fill() };
    this.commit([item]);
    this.selectedId.set(item.id);
    this.selectedPoint.set(null);
  }

  // ----- Draw ----------------------------------------------------------------------------------------

  protected onStroke(stroke: UiInkStroke): void {
    if (stroke.brush.kind === 'eraser') {
      const next = eraseItems(this.items(), stroke.pieces, this.eraseWhole());
      const changed = next.length !== this.items().length || next.some((item, i) => item !== this.items()[i]);
      if (changed) this.commit(next);
      if (this.selectedId() && !next.some((i) => i.id === this.selectedId())) this.selectedId.set(null);
      return;
    }
    // The ink goes in straight away as the pieces it was painted with (they fill exactly as drawn), and
    // is swapped for its clean outline a moment later — merging takes a beat on a phone.
    const id = newId();
    const item: UiPathItem = {
      id, name: 'Stroke', fill: this.fill(),
      contours: stroke.pieces.filter((p) => p.length > 2).map((p) => ({ closed: true, points: p.map(({ x, y }) => ({ x, y })) })),
    };
    this.commit([...this.items(), item]);
    setTimeout(() => this.settleStroke(id, stroke), 16);
  }

  private settleStroke(id: string, stroke: UiInkStroke): void {
    const contours = inkToContours(stroke.pieces, stroke.brush.size);
    if (!contours.length) return;
    const swap = (list: UiPathItem[]) => (list.some((i) => i.id === id) ? list.map((i) => (i.id === id ? { ...i, contours } : i)) : list);
    this.items.update(swap);
    this.past.update((ps) => ps.map(swap));
    this.future.update((fs) => fs.map(swap));
  }

  // ----- Points --------------------------------------------------------------------------------------

  /** Corners among the selection become curves; if they're all curves already, they all become corners. */
  private smoothSelected(): void {
    const item = this.selectedItem();
    const refs = this.selectedPoints();
    if (!item || !refs.length) return;
    const isCorner = (r: UiPointRef) => { const p = item.contours[r.contour]?.points[r.point]; return !!p && !p.in && !p.out; };
    const anyCorner = refs.some(isCorner);
    let contours = item.contours;
    for (const r of refs) if (isCorner(r) === anyCorner) contours = toggleSmooth(contours, r);
    this.updateSelected((i) => ({ ...i, contours }));
  }

  private deleteSelectedPoints(): void {
    const item = this.selectedItem();
    const refs = this.selectedPoints();
    if (!item || !refs.length) return;
    const contours = deletePoints(item.contours, refs);
    this.selectedPoint.set(null);
    if (contours.length) this.updateSelected((i) => ({ ...i, contours }));
    else this.removeItem();
  }

  private pointAction(action: 'break' | 'close'): void {
    const item = this.selectedItem();
    const ref = this.selectedPoint();
    if (!item || !ref) return;
    const contours = action === 'break' ? breakAt(item.contours, ref) : toggleClosed(item.contours, ref.contour);
    this.updateSelected((i) => ({ ...i, contours }));
    this.selectedPoint.set(null);
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
    this.pathEditor()?.finishPen(false);
    const result = itemsToPath(this.items());
    if (result) this.store.applyDrawnShape(el.id, result.path, result.box);
    this.store.shapeEditorId.set(null);
  }

  protected cancel(): void {
    this.store.shapeEditorId.set(null);
  }
}

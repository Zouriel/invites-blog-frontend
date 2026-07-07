import {
  Component, ElementRef, NgZone, OnDestroy, OnInit, computed, inject, input, model, output, signal,
} from '@angular/core';
import { UI_CONFIG } from 'ui';
import { UiDockSide, UiWindowBounds, UiWindowManager } from './window-manager';

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * `ui-window` — floating, draggable, resizable window shell ("a window inside
 * the window"). Drag the title bar to move; drag near a screen edge to snap
 * (left/right half, maximize). Resize from any edge/corner. Min/max/restore/
 * close chrome, focus-to-front z-index via {@link UiWindowManager}. Glass +
 * radius + open animation. Hosts any content via `<ng-content>`.
 */
@Component({
  selector: 'ui-window',
  template: `
    @if (snap()) { <div class="snap-preview" [style.left.px]="snapBounds().x" [style.top.px]="snapBounds().y"
                        [style.width.px]="snapBounds().width" [style.height.px]="snapBounds().height"></div> }
    <section
      class="ui-window"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.minimized]="minimized()"
      [style.left.px]="x()" [style.top.px]="y()"
      [style.width.px]="width()" [style.height.px]="minimized() ? null : height()"
      [style.z-index]="z()"
      role="dialog" [attr.aria-label]="title()"
      (pointerdown)="focus()"
      animate.enter="ui-window-open-enter"
      animate.leave="ui-window-close-leave">
      <header class="titlebar" (pointerdown)="startDrag($event)" (dblclick)="toggleMax()">
        <span class="title">{{ title() }}</span>
        <div class="chrome">
          <button type="button" class="ctl" aria-label="Minimize" (pointerdown)="$event.stopPropagation()" (click)="minimize()">—</button>
          <button type="button" class="ctl" [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'" (pointerdown)="$event.stopPropagation()" (click)="toggleMax()">{{ maximized() ? '❐' : '▢' }}</button>
          <button type="button" class="ctl close" aria-label="Close" (pointerdown)="$event.stopPropagation()" (click)="close()">✕</button>
        </div>
      </header>
      @if (!minimized()) {
        <div class="body"><ng-content /></div>
      }
      @if (resizable() && !maximized() && !minimized()) {
        @for (edge of edges; track edge) {
          <div class="rz rz-{{edge}}" (pointerdown)="startResize($event, edge)"></div>
        }
      }
    </section>
  `,
  styles: `
    :host { display: contents; }
    .ui-window {
      position: fixed; display: flex; flex-direction: column;
      min-width: 220px; min-height: 120px;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-3); font-family: var(--ui-font-default);
      overflow: hidden;
    }
    .ui-window.no-radius { border-radius: 0; }
    .ui-window.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .ui-window.minimized { min-height: 0; height: auto; }
    .titlebar { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3);
      height: 34px; padding: 0 var(--ui-space-2) 0 var(--ui-space-3); flex: none;
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border);
      cursor: grab; user-select: none; touch-action: none; }
    .titlebar:active { cursor: grabbing; }
    .title { font-size: var(--ui-font-size-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chrome { display: flex; gap: 2px; }
    .ctl { width: 26px; height: 24px; border: none; background: transparent; color: var(--ui-color-text-muted);
      border-radius: 5px; cursor: pointer; font-size: 12px; line-height: 1; }
    .ctl:hover { background: var(--ui-color-surface); color: var(--ui-color-text); }
    .ctl.close:hover { background: var(--ui-color-danger); color: #fff; }
    .ctl:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .body { flex: 1; overflow: auto; padding: var(--ui-space-4); }
    .rz { position: absolute; z-index: 3; touch-action: none; }
    .rz-n { top: -3px; left: 6px; right: 6px; height: 7px; cursor: ns-resize; }
    .rz-s { bottom: -3px; left: 6px; right: 6px; height: 7px; cursor: ns-resize; }
    .rz-e { right: -3px; top: 6px; bottom: 6px; width: 7px; cursor: ew-resize; }
    .rz-w { left: -3px; top: 6px; bottom: 6px; width: 7px; cursor: ew-resize; }
    .rz-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
    .rz-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
    .rz-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
    .rz-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
    .snap-preview { position: fixed; z-index: 1099; border-radius: var(--ui-radius);
      background: color-mix(in srgb, var(--ui-color-primary) 22%, transparent);
      border: 2px solid var(--ui-color-primary); pointer-events: none;
      transition: all var(--ui-motion-fast) var(--ui-ease-standard); }
  `,
})
export class UiWindow implements OnInit, OnDestroy {
  private config = inject(UI_CONFIG);
  private mgr = inject(UiWindowManager);
  private zone = inject(NgZone);
  readonly id = this.mgr.nextId();

  open = model(true);
  title = input('Window');
  draggable = input(true);
  resizable = input(true);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  initialX = input(80);
  initialY = input(80);
  initialWidth = input(440);
  initialHeight = input(300);
  closed = output<void>();

  protected readonly edges: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  protected readonly x = signal(0);
  protected readonly y = signal(0);
  protected readonly width = signal(440);
  protected readonly height = signal(300);
  protected readonly z = signal(1100);
  protected readonly maximized = signal(false);
  protected readonly minimized = signal(false);
  protected readonly snap = signal<UiDockSide>(null);
  private prev: UiWindowBounds | null = null;

  protected readonly snapBounds = computed(() => this.dockBounds(this.snap()));

  // ----- drag -----
  private dragStart = { px: 0, py: 0, x: 0, y: 0 };
  private dragging = false;
  private readonly dMove = (e: PointerEvent) => this.onDragMove(e);
  private readonly dUp = () => this.onDragUp();
  // ----- resize -----
  private rzEdge: ResizeEdge | null = null;
  private rzStart = { px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 };
  private readonly rMove = (e: PointerEvent) => this.onResizeMove(e);
  private readonly rUp = () => this.onResizeUp();

  ngOnInit(): void {
    this.x.set(this.initialX());
    this.y.set(this.initialY());
    this.width.set(this.initialWidth());
    this.height.set(this.initialHeight());
    this.mgr.register({
      id: this.id,
      minimize: () => this.minimized.set(true),
      restore: () => this.restore(),
      dock: (side) => this.dock(side),
      focus: () => this.focus(),
      setBounds: (b) => this.setBounds(b),
    });
    this.focus();
  }

  ngOnDestroy(): void {
    this.mgr.unregister(this.id);
    this.teardownDrag();
    this.teardownResize();
  }

  protected focus(): void {
    this.z.set(this.mgr.bringToFront(this.id));
  }

  // ---- dragging ----
  protected startDrag(e: PointerEvent): void {
    if (!this.draggable() || e.button !== 0) return;
    if (this.maximized()) { this.restore(); }
    this.dragging = true;
    this.dragStart = { px: e.clientX, py: e.clientY, x: this.x(), y: this.y() };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.dMove);
      document.addEventListener('pointerup', this.dUp);
    });
    e.preventDefault();
  }

  private onDragMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const nx = this.dragStart.x + (e.clientX - this.dragStart.px);
    const ny = this.dragStart.y + (e.clientY - this.dragStart.py);
    const side = this.detectSnap(e.clientX, e.clientY);
    this.zone.run(() => {
      this.x.set(nx);
      this.y.set(Math.max(0, ny));
      this.snap.set(side);
    });
  }

  private onDragUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.teardownDrag();
    this.zone.run(() => {
      const side = this.snap();
      this.snap.set(null);
      if (side) this.dock(side);
    });
  }

  private teardownDrag(): void {
    document.removeEventListener('pointermove', this.dMove);
    document.removeEventListener('pointerup', this.dUp);
  }

  private detectSnap(px: number, py: number): UiDockSide {
    const t = 24;
    if (py <= t) return 'maximize';
    if (px <= t) return 'left';
    if (px >= window.innerWidth - t) return 'right';
    if (py >= window.innerHeight - t) return 'bottom';
    return null;
  }

  // ---- resizing ----
  protected startResize(e: PointerEvent, edge: ResizeEdge): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.rzEdge = edge;
    this.rzStart = { px: e.clientX, py: e.clientY, x: this.x(), y: this.y(), w: this.width(), h: this.height() };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.rMove);
      document.addEventListener('pointerup', this.rUp);
    });
  }

  private onResizeMove(e: PointerEvent): void {
    if (!this.rzEdge) return;
    const dx = e.clientX - this.rzStart.px;
    const dy = e.clientY - this.rzStart.py;
    const minW = 220, minH = 120;
    let { x, y, w, h } = this.rzStart;
    const edge = this.rzEdge;
    if (edge.includes('e')) w = Math.max(minW, this.rzStart.w + dx);
    if (edge.includes('s')) h = Math.max(minH, this.rzStart.h + dy);
    if (edge.includes('w')) { w = Math.max(minW, this.rzStart.w - dx); x = this.rzStart.x + (this.rzStart.w - w); }
    if (edge.includes('n')) { h = Math.max(minH, this.rzStart.h - dy); y = this.rzStart.y + (this.rzStart.h - h); }
    this.zone.run(() => {
      this.x.set(x); this.y.set(y); this.width.set(w); this.height.set(h);
    });
  }

  private onResizeUp(): void {
    this.rzEdge = null;
    this.teardownResize();
  }

  private teardownResize(): void {
    document.removeEventListener('pointermove', this.rMove);
    document.removeEventListener('pointerup', this.rUp);
  }

  // ---- chrome / docking ----
  protected toggleMax(): void {
    this.maximized() ? this.restore() : this.dock('maximize');
  }

  protected minimize(): void {
    this.minimized.set(true);
  }

  protected close(): void {
    this.open.set(false);
    this.closed.emit();
    this.mgr.unregister(this.id);
  }

  dock(side: UiDockSide): void {
    if (!side) { this.restore(); return; }
    if (!this.prev) this.prev = { x: this.x(), y: this.y(), width: this.width(), height: this.height() };
    const b = this.dockBounds(side);
    this.applyBounds(b);
    this.maximized.set(side === 'maximize');
    this.minimized.set(false);
  }

  restore(): void {
    this.maximized.set(false);
    this.minimized.set(false);
    if (this.prev) { this.applyBounds(this.prev); this.prev = null; }
  }

  setBounds(b: UiWindowBounds): void {
    this.prev = null;
    this.maximized.set(false);
    this.minimized.set(false);
    this.applyBounds(b);
  }

  private applyBounds(b: UiWindowBounds): void {
    this.x.set(b.x); this.y.set(b.y); this.width.set(b.width); this.height.set(b.height);
  }

  private dockBounds(side: UiDockSide): UiWindowBounds {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    switch (side) {
      case 'left': return { x: 0, y: 0, width: Math.floor(vw / 2), height: vh };
      case 'right': return { x: Math.ceil(vw / 2), y: 0, width: Math.floor(vw / 2), height: vh };
      case 'bottom': return { x: 0, y: Math.ceil(vh / 2), width: vw, height: Math.floor(vh / 2) };
      case 'maximize': return { x: 0, y: 0, width: vw, height: vh };
      default: return { x: this.x(), y: this.y(), width: this.width(), height: this.height() };
    }
  }
}

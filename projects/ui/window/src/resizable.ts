import {
  AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject, input, output,
} from '@angular/core';

export type UiResizeEdge = 'e' | 's' | 'se';
export interface UiResizeEvent { width: number; height: number; }

/**
 * `uiResizable` — adds edge/corner resize handles (E, S, SE) to the host and
 * resizes it in place. Emits `(resized)` with the new dimensions. The host
 * should establish its own width/height (e.g. a sized box). Reusable behavior.
 */
@Directive({
  selector: '[uiResizable]',
  host: { '[style.position]': '"relative"' },
})
export class UiResizable implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  minWidth = input(80);
  minHeight = input(48);
  disabled = input(false, { alias: 'uiResizableDisabled' });
  resized = output<UiResizeEvent>();

  private readonly handleEls: HTMLElement[] = [];
  private edge: UiResizeEdge | null = null;
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private readonly move = (e: PointerEvent) => this.onMove(e);
  private readonly up = () => this.onUp();

  ngAfterViewInit(): void {
    const edges: UiResizeEdge[] = ['e', 's', 'se'];
    for (const edge of edges) {
      const el = document.createElement('div');
      el.className = `ui-resize-handle ui-resize-${edge}`;
      Object.assign(el.style, this.styleFor(edge));
      el.addEventListener('pointerdown', (e) => this.onDown(e, edge));
      this.host.nativeElement.appendChild(el);
      this.handleEls.push(el);
    }
  }

  private styleFor(edge: UiResizeEdge): Partial<CSSStyleDeclaration> {
    const base: Partial<CSSStyleDeclaration> = { position: 'absolute', zIndex: '2', touchAction: 'none' };
    if (edge === 'e') return { ...base, top: '0', right: '0', width: '6px', height: '100%', cursor: 'ew-resize' };
    if (edge === 's') return { ...base, left: '0', bottom: '0', width: '100%', height: '6px', cursor: 'ns-resize' };
    return { ...base, right: '0', bottom: '0', width: '14px', height: '14px', cursor: 'nwse-resize' };
  }

  private onDown(e: PointerEvent, edge: UiResizeEdge): void {
    if (this.disabled() || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.edge = edge;
    this.start = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.move);
      document.addEventListener('pointerup', this.up);
    });
  }

  private onMove(e: PointerEvent): void {
    if (!this.edge) return;
    let w = this.start.w;
    let h = this.start.h;
    if (this.edge === 'e' || this.edge === 'se') w = Math.max(this.minWidth(), this.start.w + (e.clientX - this.start.x));
    if (this.edge === 's' || this.edge === 'se') h = Math.max(this.minHeight(), this.start.h + (e.clientY - this.start.y));
    const el = this.host.nativeElement;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    this.zone.run(() => this.resized.emit({ width: w, height: h }));
  }

  private onUp(): void {
    this.edge = null;
    document.removeEventListener('pointermove', this.move);
    document.removeEventListener('pointerup', this.up);
  }

  ngOnDestroy(): void {
    this.onUp();
  }
}

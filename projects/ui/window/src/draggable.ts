import {
  Directive, ElementRef, NgZone, OnDestroy, computed, inject, input, model, output,
} from '@angular/core';

export interface UiDragPosition { x: number; y: number; }
export interface UiDragEvent extends UiDragPosition { pointerX: number; pointerY: number; }

/**
 * `uiDraggable` — makes the host element draggable via pointer. Moves the host
 * with a CSS transform and keeps a two-way `[(position)]`. Restrict the grab
 * area with `uiDragHandle` (a child element). Reusable behavior directive.
 */
@Directive({
  selector: '[uiDraggable]',
  host: {
    '[style.transform]': 'transform()',
    '[style.touch-action]': '"none"',
    '(pointerdown)': 'onPointerDown($event)',
  },
})
export class UiDraggable implements OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  uiDragHandle = input<HTMLElement>();
  disabled = input(false, { alias: 'uiDraggableDisabled' });
  position = model<UiDragPosition>({ x: 0, y: 0 });
  dragStart = output<UiDragEvent>();
  dragMove = output<UiDragEvent>();
  dragEnd = output<UiDragEvent>();

  protected readonly transform = computed(() => {
    const p = this.position();
    return `translate(${p.x}px, ${p.y}px)`;
  });

  private startPointer = { x: 0, y: 0 };
  private startPos: UiDragPosition = { x: 0, y: 0 };
  private dragging = false;
  private readonly move = (e: PointerEvent) => this.onPointerMove(e);
  private readonly up = (e: PointerEvent) => this.onPointerUp(e);

  protected onPointerDown(e: PointerEvent): void {
    if (this.disabled() || e.button !== 0) return;
    const handle = this.uiDragHandle();
    if (handle && !handle.contains(e.target as Node)) return;
    this.dragging = true;
    this.startPointer = { x: e.clientX, y: e.clientY };
    this.startPos = { ...this.position() };
    this.host.nativeElement.setPointerCapture?.(e.pointerId);
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.move);
      document.addEventListener('pointerup', this.up);
    });
    this.dragStart.emit({ ...this.startPos, pointerX: e.clientX, pointerY: e.clientY });
    e.preventDefault();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const next = {
      x: this.startPos.x + (e.clientX - this.startPointer.x),
      y: this.startPos.y + (e.clientY - this.startPointer.y),
    };
    this.zone.run(() => {
      this.position.set(next);
      this.dragMove.emit({ ...next, pointerX: e.clientX, pointerY: e.clientY });
    });
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.teardown();
    this.zone.run(() => this.dragEnd.emit({ ...this.position(), pointerX: e.clientX, pointerY: e.clientY }));
  }

  private teardown(): void {
    document.removeEventListener('pointermove', this.move);
    document.removeEventListener('pointerup', this.up);
  }

  ngOnDestroy(): void {
    this.teardown();
  }
}

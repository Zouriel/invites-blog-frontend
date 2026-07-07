import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

/** `ui-image-viewer` — zoom (buttons/wheel), pan (drag), and fit/reset. */
@Component({
  selector: 'ui-image-viewer',
  imports: [DecimalPipe],
  template: `
    <div class="iv">
      <div class="stage" (wheel)="onWheel($event)" (pointerdown)="startPan($event)"
           (pointermove)="pan($event)" (pointerup)="endPan()" (pointerleave)="endPan()">
        <img [src]="src()" [alt]="alt()" [style.transform]="transform()" draggable="false" />
      </div>
      <div class="bar">
        <button type="button" (click)="zoomBy(-0.25)" aria-label="Zoom out">−</button>
        <span class="pct">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
        <button type="button" (click)="zoomBy(0.25)" aria-label="Zoom in">+</button>
        <button type="button" (click)="reset()" aria-label="Reset view">Fit</button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .iv { display: flex; flex-direction: column; height: 100%; min-height: 200px; }
    .stage { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center;
      background: var(--ui-color-bg); cursor: grab; touch-action: none; }
    .stage:active { cursor: grabbing; }
    img { max-width: 100%; max-height: 100%; user-select: none; transition: transform 60ms linear; }
    .bar { display: flex; align-items: center; gap: var(--ui-space-2); justify-content: center;
      padding: var(--ui-space-2); border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .bar button { width: 28px; height: 26px; border: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      color: var(--ui-color-text); border-radius: var(--ui-radius); cursor: pointer; font-family: var(--ui-font-default); }
    .bar button:hover { background: var(--ui-color-surface-raised); }
    .pct { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); min-width: 42px; text-align: center; }
  `,
})
export class UiImageViewer {
  src = input.required<string>();
  alt = input('');
  protected readonly zoom = signal(1);
  protected readonly offset = signal({ x: 0, y: 0 });
  private panning = false;
  private last = { x: 0, y: 0 };

  protected readonly transform = computed(() => {
    const o = this.offset();
    return `translate(${o.x}px, ${o.y}px) scale(${this.zoom()})`;
  });

  protected zoomBy(d: number): void {
    this.zoom.update((z) => Math.min(6, Math.max(0.25, +(z + d).toFixed(2))));
  }
  protected onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? 0.15 : -0.15);
  }
  protected reset(): void {
    this.zoom.set(1);
    this.offset.set({ x: 0, y: 0 });
  }
  protected startPan(e: PointerEvent): void {
    this.panning = true;
    this.last = { x: e.clientX, y: e.clientY };
  }
  protected pan(e: PointerEvent): void {
    if (!this.panning) return;
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.last = { x: e.clientX, y: e.clientY };
    this.offset.update((o) => ({ x: o.x + dx, y: o.y + dy }));
  }
  protected endPan(): void { this.panning = false; }
}

import { Component, NgZone, OnDestroy, ElementRef, inject, input, signal } from '@angular/core';

/**
 * `ui-splitter` — two resizable panes with a draggable divider. Project two
 * elements with `[split-a]` and `[split-b]`.
 */
@Component({
  selector: 'ui-splitter',
  template: `
    <div class="sp" [class.vertical]="orientation() === 'vertical'" #root>
      <div class="pane" [style.flex-basis.%]="ratio()"><ng-content select="[split-a]" /></div>
      <div class="gutter" role="separator" tabindex="0"
           [attr.aria-orientation]="orientation()"
           (pointerdown)="start($event)"
           (keydown)="onKey($event)"></div>
      <div class="pane"><ng-content select="[split-b]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .sp { display: flex; height: 100%; width: 100%; }
    .sp.vertical { flex-direction: column; }
    .pane { overflow: auto; flex: 1 1 0; min-width: 0; min-height: 0; }
    .sp > .pane:first-child { flex: 0 0 auto; }
    .gutter { flex: none; background: var(--ui-color-border); position: relative; }
    .sp:not(.vertical) .gutter { width: 1px; cursor: col-resize; }
    .sp.vertical .gutter { height: 1px; cursor: row-resize; }
    .gutter::after { content: ''; position: absolute; inset: -3px; }
    .gutter:hover, .gutter:focus-visible { background: var(--ui-color-primary); outline: none; }
  `,
})
export class UiSplitter implements OnDestroy {
  private root = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Size of the first pane as a percentage (0–100). */
  ratio = signal(50);

  private dragging = false;
  private readonly move = (e: PointerEvent) => this.onMove(e);
  private readonly up = () => this.end();

  protected start(e: PointerEvent): void {
    e.preventDefault();
    this.dragging = true;
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.move);
      document.addEventListener('pointerup', this.up);
    });
  }
  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const el = this.root.nativeElement;
    const rect = el.getBoundingClientRect();
    const pct = this.orientation() === 'vertical'
      ? ((e.clientY - rect.top) / rect.height) * 100
      : ((e.clientX - rect.left) / rect.width) * 100;
    this.zone.run(() => this.ratio.set(Math.min(90, Math.max(10, pct))));
  }
  private end(): void {
    this.dragging = false;
    document.removeEventListener('pointermove', this.move);
    document.removeEventListener('pointerup', this.up);
  }
  protected onKey(e: KeyboardEvent): void {
    const step = 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); this.ratio.update((r) => Math.max(10, r - step)); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); this.ratio.update((r) => Math.min(90, r + step)); }
  }
  ngOnDestroy(): void { this.end(); }
}

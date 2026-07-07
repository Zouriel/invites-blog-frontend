import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, output } from '@angular/core';

export interface UiSize2D { width: number; height: number; }

/** `uiResizeObserver` — emits `(uiResizeObserver)` with the host's content-box size on change. */
@Directive({
  selector: '[uiResizeObserver]',
})
export class UiResizeObserver implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  sizeChange = output<UiSize2D>({ alias: 'uiResizeObserver' });

  private observer?: ResizeObserver;

  ngOnInit(): void {
    this.observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) this.zone.run(() => this.sizeChange.emit({ width: rect.width, height: rect.height }));
    });
    this.observer.observe(this.host.nativeElement);
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }
}

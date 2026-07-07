import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input, output } from '@angular/core';

/** `uiIntersect` — emits `(intersect)` with visibility as the host enters/leaves the viewport. */
@Directive({
  selector: '[uiIntersect]',
})
export class UiIntersect implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  rootMargin = input('0px', { alias: 'uiIntersectRootMargin' });
  /** Emit only the first time the element becomes visible, then stop. */
  once = input(false, { alias: 'uiIntersectOnce' });
  intersect = output<boolean>({ alias: 'uiIntersect' });

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.zone.run(() => this.intersect.emit(entry.isIntersecting));
        if (entry.isIntersecting && this.once()) this.observer?.disconnect();
      }
    }, { rootMargin: this.rootMargin() });
    this.observer.observe(this.host.nativeElement);
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }
}

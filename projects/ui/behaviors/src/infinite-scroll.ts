import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input, output } from '@angular/core';

/**
 * `uiInfiniteScroll` — emits `(scrolledToEnd)` when the host scrolls within
 * `threshold` px of the bottom. Re-arms once scrolled back up.
 */
@Directive({
  selector: '[uiInfiniteScroll]',
})
export class UiInfiniteScroll implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  threshold = input(120, { alias: 'uiInfiniteScrollThreshold' });
  disabled = input(false, { alias: 'uiInfiniteScrollDisabled' });
  scrolledToEnd = output<void>();

  private armed = true;
  private readonly onScroll = () => this.check();

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => this.host.nativeElement.addEventListener('scroll', this.onScroll, { passive: true }));
  }
  ngOnDestroy(): void {
    this.host.nativeElement.removeEventListener('scroll', this.onScroll);
  }

  private check(): void {
    if (this.disabled()) return;
    const el = this.host.nativeElement;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= this.threshold()) {
      if (this.armed) { this.armed = false; this.zone.run(() => this.scrolledToEnd.emit()); }
    } else {
      this.armed = true;
    }
  }
}

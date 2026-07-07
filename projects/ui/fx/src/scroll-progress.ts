import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, inject, viewChild } from '@angular/core';

/** `ui-scroll-progress` — fixed top bar tracking page scroll, using the brand gradient + glow. */
@Component({
  selector: 'ui-scroll-progress',
  template: `<div #bar class="bar" aria-hidden="true"></div>`,
  styles: `
    :host { position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: var(--ui-z-overlay, 1000); pointer-events: none; background: rgba(255,255,255,0.05); }
    .bar { height: 100%; width: 0%;
      background: var(--ui-gradient-brand, linear-gradient(90deg, var(--ui-color-primary), var(--ui-color-primary-hover)));
      box-shadow: var(--ui-glow-amber, 0 0 12px color-mix(in srgb, var(--ui-color-primary) 60%, transparent));
      transform-origin: left center; will-change: width; transition: width .08s linear; }
  `,
})
export class UiScrollProgress implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private bar = viewChild.required<ElementRef<HTMLDivElement>>('bar');
  private readonly onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    this.bar().nativeElement.style.width = `${pct}%`;
  };
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => { window.addEventListener('scroll', this.onScroll, { passive: true }); this.onScroll(); });
  }
  ngOnDestroy(): void { window.removeEventListener('scroll', this.onScroll); }
}

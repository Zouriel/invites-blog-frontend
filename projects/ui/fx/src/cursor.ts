import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, inject, input, viewChild } from '@angular/core';

/**
 * `ui-cursor` — custom cursor: a precise dot plus a lagging ring that grows
 * over interactive elements. Mount once near the app root. Hidden on touch
 * devices and when reduced motion is requested. Pair with `body { cursor: none }`.
 */
@Component({
  selector: 'ui-cursor',
  template: `
    <div #ring class="ring" aria-hidden="true"></div>
    <div #dot class="dot" aria-hidden="true"></div>
  `,
  host: {
    '[class.hover]': 'hover',
    '[class.down]': 'down',
    '[class.out]': 'out',
  },
  styles: `
    :host { position: fixed; inset: 0; pointer-events: none; z-index: var(--ui-z-toast, 1200); }
    .dot, .ring { position: fixed; top: 0; left: 0; pointer-events: none; will-change: transform, width, height, opacity; mix-blend-mode: difference; }
    .dot { width: 6px; height: 6px; border-radius: 9999px; background: #fff; transform: translate3d(-100px,-100px,0); transition: opacity .25s ease; }
    .ring { width: 38px; height: 38px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.85);
      transform: translate3d(-100px,-100px,0);
      transition: width .35s cubic-bezier(.16,1,.3,1), height .35s cubic-bezier(.16,1,.3,1), border-color .25s ease, background .25s ease, opacity .25s ease; }
    :host(.hover) .ring { width: 64px; height: 64px; background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.95); }
    :host(.down) .ring { width: 28px; height: 28px; }
    :host(.out) .dot, :host(.out) .ring { opacity: 0; }
    @media (pointer: coarse) { :host { display: none; } }
    @media (prefers-reduced-motion: reduce) { :host { display: none; } }
  `,
})
export class UiCursor implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  /** CSS selector for elements that trigger the enlarged "hover" ring. */
  interactiveSelector = input('a, button, [data-magnetic], input, textarea, select, [role="button"]');
  private dot = viewChild.required<ElementRef<HTMLDivElement>>('dot');
  private ring = viewChild.required<ElementRef<HTMLDivElement>>('ring');

  protected hover = false;
  protected down = false;
  protected out = false;

  private tx = 0; private ty = 0; private rx = 0; private ry = 0; private raf = 0;
  private readonly onMove = (e: PointerEvent) => { this.tx = e.clientX; this.ty = e.clientY; this.out = false; };
  private readonly onDown = () => (this.down = true);
  private readonly onUp = () => (this.down = false);
  private readonly onLeave = () => (this.out = true);
  private readonly onOver = (e: Event) => {
    const t = e.target as HTMLElement;
    this.hover = !!t?.closest?.(this.interactiveSelector());
  };

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    window.addEventListener('pointerleave', this.onLeave, { passive: true });
    document.addEventListener('pointerover', this.onOver, true);
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        this.rx += (this.tx - this.rx) * 0.18;
        this.ry += (this.ty - this.ry) * 0.18;
        this.dot().nativeElement.style.transform = `translate3d(${this.tx - 3}px, ${this.ty - 3}px, 0)`;
        this.ring().nativeElement.style.transform = `translate3d(${this.rx - 19}px, ${this.ry - 19}px, 0)`;
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointerleave', this.onLeave);
    document.removeEventListener('pointerover', this.onOver, true);
  }
}

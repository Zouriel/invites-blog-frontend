import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * `uiMagnetic` — the host gently pulls toward the cursor on hover and springs
 * back on leave (a signature "dramatic" micro-interaction). Self-contained;
 * disabled on touch / reduced-motion.
 *
 *   <a uiMagnetic [magneticStrength]="0.4">…</a>
 */
@Directive({
  selector: '[uiMagnetic]',
  host: { 'data-magnetic': '' },
})
export class UiMagnetic implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  /** Fraction of the cursor offset the element follows (0–1). */
  magneticStrength = input(0.35);
  /** Extra px around the element that still attracts the cursor. */
  magneticRadius = input(0);

  private readonly onMove = (e: PointerEvent) => this.pull(e);
  private readonly onLeave = () => this.reset();

  ngOnInit(): void {
    if (typeof window === 'undefined' || window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = this.host.nativeElement;
    el.style.transition = 'transform .35s cubic-bezier(.16,1,.3,1)';
    el.style.willChange = 'transform';
    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointermove', this.onMove);
      el.addEventListener('pointerleave', this.onLeave);
    });
  }

  private pull(e: PointerEvent): void {
    const el = this.host.nativeElement;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const s = this.magneticStrength();
    el.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
  }
  private reset(): void {
    this.host.nativeElement.style.transform = 'translate(0,0)';
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
  }
}

import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';

export type UiRevealMode = 'up' | 'down' | 'left' | 'right' | 'blur' | 'scale';

const FROM: Record<UiRevealMode, string> = {
  up: 'translateY(28px)',
  down: 'translateY(-28px)',
  left: 'translateX(-40px)',
  right: 'translateX(40px)',
  blur: 'translateY(20px)',
  scale: 'scale(0.94)',
};

/**
 * `uiReveal` — reveals the host as it scrolls into view (IntersectionObserver).
 * Self-contained (applies its own inline transitions; no global CSS needed).
 * Honors `prefers-reduced-motion`.
 *
 *   <div uiReveal>…</div>
 *   <div uiReveal="blur" [revealDelay]="120">…</div>
 */
@Directive({
  selector: '[uiReveal]',
})
export class UiReveal implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  mode = input<UiRevealMode>('up', { alias: 'uiReveal' });
  revealDelay = input(0);
  revealThreshold = input(0.18);
  revealOnce = input(true);
  duration = input(900);

  private io?: IntersectionObserver;

  ngOnInit(): void {
    const el = this.host.nativeElement;
    if (typeof IntersectionObserver === 'undefined') return;

    // Animation-first: entrance reveals play even under reduced-motion (they're a gentle, one-shot
    // fade+slide, not continuous motion). Under reduce we soften the travel distance.
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = this.mode();
    el.style.opacity = '0';
    el.style.willChange = 'opacity, transform, filter';
    if (reduce) {
      // Calm fade: a tiny lift, no blur, no large slide.
      el.style.transform = 'translateY(6px)';
    } else {
      if (mode === 'blur') el.style.filter = 'blur(18px)';
      el.style.transform = FROM[mode] ?? FROM.up;
    }

    this.zone.runOutsideAngular(() => {
      this.io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.show(el, mode);
            if (this.revealOnce()) this.io?.unobserve(entry.target);
          } else if (!this.revealOnce()) {
            this.hide(el, mode);
          }
        }
      }, { threshold: this.revealThreshold(), rootMargin: '0px 0px -8% 0px' });
      this.io.observe(el);
    });
  }

  private show(el: HTMLElement, mode: UiRevealMode): void {
    const d = this.duration();
    const ease = 'cubic-bezier(.16,1,.3,1)';
    el.style.transition = `opacity ${d}ms ${ease} ${this.revealDelay()}ms, transform ${d}ms ${ease} ${this.revealDelay()}ms, filter ${d}ms ${ease} ${this.revealDelay()}ms`;
    el.style.opacity = '1';
    el.style.transform = mode === 'scale' ? 'scale(1)' : 'translate(0,0)';
    el.style.filter = 'blur(0)';
  }
  private hide(el: HTMLElement, mode: UiRevealMode): void {
    el.style.opacity = '0';
    if (mode === 'blur') el.style.filter = 'blur(18px)';
    el.style.transform = FROM[mode] ?? FROM.up;
  }

  ngOnDestroy(): void { this.io?.disconnect(); }
}

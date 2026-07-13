import { AfterViewInit, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * `uiSplitText` — splits the host's text into per-character spans and animates
 * them in with a stagger (Web Animations API; no global keyframes needed).
 * Best on a single line/heading. Honors `prefers-reduced-motion`.
 *
 *   <h1 uiSplitText>Mohamed</h1>
 */
@Directive({
  selector: '[uiSplitText]',
})
export class UiSplitText implements AfterViewInit {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Per-character delay (ms). */
  stagger = input(35);
  /** Initial delay before the first character (ms). */
  base = input(120);
  duration = input(900);

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    const text = el.textContent ?? '';
    if (!text.trim()) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.textContent = '';
    const frag = document.createDocumentFragment();
    const spans: HTMLElement[] = [];
    for (const ch of Array.from(text)) {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? ' ' : ch;
      span.style.display = 'inline-block';
      span.style.willChange = 'transform, opacity';
      frag.appendChild(span);
      spans.push(span);
    }
    el.appendChild(frag);

    if (typeof Element.prototype.animate !== 'function') return;
    // Animation-first: the headline reveal plays even under reduced-motion, softened to a gentle
    // per-character fade (no rotation / big travel) so it stays comfortable.
    const from = reduce
      ? { opacity: 0, transform: 'translateY(0.2em)' }
      : { opacity: 0, transform: 'translateY(0.9em) rotate(8deg)' };
    const to = { opacity: 1, transform: 'translateY(0) rotate(0)' };
    spans.forEach((span, i) => {
      span.animate([from, to], {
        duration: this.duration(),
        delay: this.base() + i * this.stagger(),
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'both',
      });
    });
  }
}

import { Directive, ElementRef, inject, input } from '@angular/core';

/** `uiRipple` — emits a material-style ripple from the pointer position on press. */
@Directive({
  selector: '[uiRipple]',
  host: {
    '(pointerdown)': 'spawn($event)',
    '[style.position]': '"relative"',
    '[style.overflow]': '"hidden"',
  },
})
export class UiRipple {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  disabled = input(false, { alias: 'uiRippleDisabled' });
  color = input('currentColor', { alias: 'uiRippleColor' });

  protected spawn(e: PointerEvent): void {
    if (this.disabled()) return;
    const el = this.host.nativeElement;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;transform:scale(0);opacity:0.35;width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;background:${this.color()};transition:transform 480ms cubic-bezier(0.2,0,0,1),opacity 600ms;`;
    el.appendChild(ripple);
    requestAnimationFrame(() => { ripple.style.transform = 'scale(2.2)'; ripple.style.opacity = '0'; });
    setTimeout(() => ripple.remove(), 620);
  }
}

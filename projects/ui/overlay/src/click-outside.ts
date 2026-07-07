import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, output } from '@angular/core';

/**
 * `uiClickOutside` — emits when a pointer/focus event occurs outside the host
 * element. Used by popovers, dropdowns, and menus to dismiss on outside click.
 */
@Directive({
  selector: '[uiClickOutside]',
  host: {
    '(document:pointerdown)': 'onDocument($event)',
  },
})
export class UiClickOutside {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private doc = inject(DOCUMENT);
  uiClickOutside = output<PointerEvent>();

  protected onDocument(event: PointerEvent): void {
    const target = event.target as Node | null;
    if (!target || !this.doc.contains(target)) return;
    if (!this.el.nativeElement.contains(target)) {
      this.uiClickOutside.emit(event);
    }
  }
}

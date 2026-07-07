import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component, Directive, ElementRef, inject, input, OnDestroy, signal,
} from '@angular/core';

export type UiTooltipPosition = 'top' | 'bottom' | 'left' | 'right';

let tooltipSeq = 0;

/** Internal panel rendered inside the CDK overlay. */
@Component({
  selector: 'ui-tooltip-panel',
  template: `<div class="ui-tooltip" role="tooltip" [id]="id">{{ text() }}</div>`,
  styles: `
    .ui-tooltip {
      max-width: 240px; padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: 8px;
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
      box-shadow: var(--ui-shadow-2); pointer-events: none;
      animation: ui-fade-in var(--ui-motion-fast) var(--ui-ease-standard);
    }
    @media (prefers-reduced-motion: reduce) { .ui-tooltip { animation: none; } }
  `,
})
export class UiTooltipPanel {
  readonly text = signal('');
  id = `ui-tooltip-${tooltipSeq++}`;
}

/**
 * `uiTooltip` — accessible hover/focus tooltip backed by the CDK Overlay.
 * Sets `aria-describedby` on the host so screen readers announce it.
 */
@Directive({
  selector: '[uiTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class UiTooltip implements OnDestroy {
  text = input.required<string>({ alias: 'uiTooltip' });
  position = input<UiTooltipPosition>('top', { alias: 'uiTooltipPosition' });

  private overlay = inject(Overlay);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private ref: OverlayRef | null = null;
  private panel: UiTooltipPanel | null = null;
  protected readonly describedBy = signal<string | null>(null);

  protected show(): void {
    if (this.ref || !this.text()) return;
    const pos = this.positionFor(this.position());
    this.ref = this.overlay.create({
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(this.el)
        .withPositions([pos])
        .withPush(true),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    const componentRef = this.ref.attach(new ComponentPortal(UiTooltipPanel));
    this.panel = componentRef.instance;
    this.panel.text.set(this.text());
    this.describedBy.set(this.panel.id);
  }

  protected hide(): void {
    this.ref?.dispose();
    this.ref = null;
    this.panel = null;
    this.describedBy.set(null);
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private positionFor(p: UiTooltipPosition) {
    const gap = 8;
    switch (p) {
      case 'bottom': return { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: gap } as const;
      case 'left':   return { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -gap } as const;
      case 'right':  return { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: gap } as const;
      default:       return { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -gap } as const;
    }
  }
}

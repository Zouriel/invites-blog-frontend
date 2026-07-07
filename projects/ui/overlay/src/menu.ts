import {
  CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition,
} from '@angular/cdk/overlay';
import {
  Component, ElementRef, inject, input, model, output, viewChild,
} from '@angular/core';
import { UI_CONFIG } from 'ui';

export interface UiMenuItem {
  label: string;
  value: string;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * `ui-menu` — dropdown menu anchored to a trigger (CDK Overlay). Project the
 * trigger with `[menu-trigger]`; pass `items` and listen to `(select)`.
 * Arrow keys move focus, Enter activates, Escape closes (WAI-ARIA menu).
 */
@Component({
  selector: 'ui-menu',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <span class="trigger" cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="toggle()">
      <ng-content select="[menu-trigger]" />
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="open.set(false)"
      (attach)="focusFirst()"
      (detach)="open.set(false)">
      <div
        #panel
        class="ui-menu"
        [class.glass]="glass()"
        [class.no-radius]="!radius()"
        role="menu"
        (keydown)="onKeydown($event)">
        @for (item of items(); track item.value) {
          <button
            type="button"
            role="menuitem"
            class="item"
            [class.danger]="item.danger"
            [disabled]="item.disabled"
            (click)="choose(item)">
            {{ item.label }}
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .trigger { display: inline-flex; }
    .ui-menu {
      display: flex; flex-direction: column; min-width: 180px;
      margin-top: var(--ui-space-2); padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default);
      animation: ui-scale-in var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-menu.no-radius { border-radius: 0; }
    .ui-menu.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .item {
      display: flex; align-items: center; gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3);
      background: transparent; border: none; border-radius: 6px;
      color: inherit; font: inherit; text-align: left; cursor: pointer;
    }
    .item:hover:not(:disabled), .item:focus-visible { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); outline: none; }
    .item.danger { color: var(--ui-color-danger); }
    .item:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) { .ui-menu { animation: none; } }
  `,
})
export class UiMenu {
  private config = inject(UI_CONFIG);
  open = model(false);
  items = input<UiMenuItem[]>([]);
  select = output<UiMenuItem>();
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);

  private panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];

  protected toggle(): void { this.open.update((v) => !v); }

  protected choose(item: UiMenuItem): void {
    if (item.disabled) return;
    this.select.emit(item);
    this.open.set(false);
  }

  protected focusFirst(): void {
    queueMicrotask(() => this.itemEls()[0]?.focus());
  }

  protected onKeydown(e: KeyboardEvent): void {
    const els = this.itemEls();
    if (!els.length) return;
    const current = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(current + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(current - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.open.set(false); }
  }

  private itemEls(): HTMLButtonElement[] {
    const el = this.panel()?.nativeElement;
    return el ? Array.from(el.querySelectorAll<HTMLButtonElement>('.item:not([disabled])')) : [];
  }
}
